
const St = imports.gi.St;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;

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

class Extension {

    constructor() {
        this._indicator = null;
        this._statusLabel = null;
        this._WINDOW_SIZE = 10;
        this._window = Array.apply(null, {length: this._WINDOW_SIZE}).map(x => 0);
    }

    enable() {
        log(`enabling ${Me.metadata.name}`);

        this._indicator = new St.Bin({ style_class: 'label-style',
                          reactive: true,
                          can_focus: true,
                          x_fill: true,
                          y_fill: false,
                          track_hover: true });
        this._statusLabel = new St.Label({ text: '00', y_expand: true, y_align: Clutter.ActorAlign.CENTER });

        this._indicator.set_child(this._statusLabel);

        Main.panel._rightBox.insert_child_at_index(this._indicator, 0);

        this._sourceId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1.5, () => {
            this._querySensors();
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        log(`disabling ${Me.metadata.name}`);

        Main.panel._rightBox.remove_child(this._indicator);
        this._indicator.destroy();
        this._indicator = null;

        if (this._sourceId) {
            GLib.Source.remove(this._sourceId);
            this._sourceId = null;
        }
    }

    _querySensors() {

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
            this._window.shift();
            this._window.push(num);
            let apm = this._window.reduce((a,b)=>a+b) * 60 / this._WINDOW_SIZE;

            this._statusLabel.text = "APM: " + String(apm);
        }).catch(e => {log(e.toString());});
    }
}

function init() {

    log(`initializing ${Me.metadata.name}`);

    return new Extension();

}
