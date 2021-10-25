
const St = imports.gi.St;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

let text, button, statusLabel;

const window_size = 10;
let window = Array.apply(null, {length: window_size}).map(x => 0);

async function execCommand(argv, cancellable=null) {
    try {
        // There is also a reusable Gio.SubprocessLauncher class available
        let proc = new Gio.Subprocess({
            argv: argv,
            // There are also other types of flags for merging stdout/stderr,
            // redirecting to /dev/null or inheriting the parent's pipes
            flags: Gio.SubprocessFlags.STDOUT_PIPE
        });
        
        // Classes that implement GInitable must be initialized before use, but
        // an alternative in this case is to use Gio.Subprocess.new(argv, flags)
        //
        // If the class implements GAsyncInitable then Class.new_async() could
        // also be used and awaited in a Promise.
        proc.init(null);

        let stdout = await new Promise((resolve, reject) => {
            // communicate_utf8() returns a string, communicate() returns a
            // a GLib.Bytes and there are "headless" functions available as well
            proc.communicate_utf8_async(null, cancellable, (proc, res) => {
                let ok, stdout, stderr;

                try {
                    [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
                    resolve(stdout);
                } catch (e) {
                    reject(e);
                }
            });
        });

        return stdout;
    } catch (e) {
        logError(e);
    }
}

function _hideHello() {
    Main.uiGroup.remove_actor(text);
    text = null;
}

function _showHello() {
    if (!text) {
        text = new St.Label({ style_class: 'helloworld-label', text: statusLabel.text });
        Main.uiGroup.add_actor(text);
    }

    text.opacity = 255;

    let monitor = Main.layoutManager.primaryMonitor;

    text.set_position(monitor.x + Math.floor(monitor.width / 2 - text.width / 2),
                      monitor.y + Math.floor(monitor.height / 2 - text.height / 2));

    Tweener.addTween(text,
                     { opacity: 0,
                       time: 2,
                       transition: 'easeOutQuad',
                       onComplete: _hideHello });
}

let _querySensors = function(){

    const cmd_xinput = "xinput --test-xi2 --root";
    const cmd_timeout = "timeout 1 cat";
    const cmd_grep = "grep -Pzo '(RawButtonPress.*\\n.*\\n.*detail: (1|2|3)\\n|RawKeyPress.*\\n.*\\n.*\\n)'";
    const cmd_wc = "wc -l";
    const cmd_all = [cmd_xinput, cmd_timeout, cmd_grep, cmd_wc];
    let command = cmd_all.join(" | ");

    //let command = "xinput --test-xi2 --root | timeout 1 cat | grep -E \"RawButtonPress|RawKeyPress\" | wc -l";
    let full_command = ["/bin/bash", "-c", command];

    execCommand(full_command).then(stdout => {
        let num = Number(stdout.split('\n')[0]) / 3;
        window.shift();
        window.push(num);
        let apm = window.reduce((a,b)=>a+b) * 60 / window_size;

        statusLabel.text = "APM: " + String(apm);
    }).catch(e => {log(e.toString());});

}

function init() {

    log("APM Counter INIT");

    button = new St.Bin({ style_class: 'label-style',
                          reactive: true,
                          can_focus: true,
                          x_fill: true,
                          y_fill: false,
                          track_hover: true });
    let icon = new St.Icon({ icon_name: 'system-run-symbolic',
                             style_class: 'system-status-icon' });
    
    statusLabel = new St.Label({ text: '00', y_expand: true, y_align: Clutter.ActorAlign.CENTER });
    //statusLabel.text = "0"

    button.set_child(statusLabel);
    button.connect('button-press-event', _showHello);

    let cnt = 0;

    this._eventLoop = Mainloop.timeout_add(1500, Lang.bind(this, function (){
        cnt +=1;
        //statusLabel.text = String(cnt);

        _querySensors();
        // readd to update queue
        return true;
    }));
}

function enable() {
    Main.panel._rightBox.insert_child_at_index(button, 0);
}

function disable() {
    Main.panel._rightBox.remove_child(button);
}
