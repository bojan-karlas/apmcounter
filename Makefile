.PHONY: pack clean install uninstall

pack:
	mkdir -p pkg/
	cd src;	zip -r ../pkg/apmcounter@bojan.ninja.zip ./*

clean:
	rm -rf pkg/

install: uninstall
	mkdir -p $(HOME)/.local/share/gnome-shell/extensions/apmcounter@bojan.ninja
	cp -r src/* $(HOME)/.local/share/gnome-shell/extensions/apmcounter@bojan.ninja/

uninstall:
	rm -rf $(HOME)/.local/share/gnome-shell/extensions/apmcounter@bojan.ninja
