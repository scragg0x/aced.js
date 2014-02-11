function Aced(settings) {
    var id, options, editor, element, preview, profile, autoInterval, storage, themes;

    settings = settings || {};

    options = {
        sanitize: true,
        preview: null,
        editor: null,
        theme: 'idle_fingers',
        mode: 'markdown',
        autoSave: true,
        autoSaveInterval: 3000,
        syncPreview: true,
        keyMaster: false,
        submit: function(data){ console.log(data); },
        showButtonBar: true
    };

    themes = {
        chrome: "Chrome",
        clouds: "Clouds",
        clouds_midnight: "Clouds Midnight",
        cobalt: "Cobalt",
        crimson_editor: "Crimson Editor",
        dawn: "Dawn",
        dreamweaver: "Dreamweaver",
        eclipse: "Eclipse",
        idle_fingers: "idleFingers",
        kr_theme: "krTheme",
        merbivore: "Merbivore",
        merbivore_soft: "Merbivore Soft",
        mono_industrial: "Mono Industrial",
        monokai: "Monokai",
        pastel_on_dark: "Pastel on Dark",
        solarized_dark: "Solarized Dark",
        solarized_light: "Solarized Light",
        textmate: "TextMate",
        tomorrow: "Tomorrow",
        tomorrow_night: "Tomorrow Night",
        tomorrow_night_blue: "Tomorrow Night Blue",
        tomorrow_night_bright: "Tomorrow Night Bright",
        tomorrow_night_eighties: "Tomorrow Night 80s",
        twilight: "Twilight",
        vibrant_ink: "Vibrant Ink"
    };

    function buildThemeSelect() {
        var $button = $('<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown">Theme</button>');
        var $sel = $("<ul class='aced-theme-sel dropdown-menu'></ul>");
        $.each(themes, function(k, v) {
           $sel.append("<li><a tabindex='-1' href='#' data-value='" + k + "'>" + v + "</li>");
        });
        return $("<div />").append($button).append($sel);
    }

    function toJquery(o) {
        if (typeof o == 'string') {
            return $("#" + o);
        } else {
            return $(o);
        }
    }

    function hasLocalStorage() {
        // http://mathiasbynens.be/notes/localstorage-pattern
        var storage;
        try {
            if (localStorage.getItem) {
                storage = localStorage
            }
        } catch (e) {}
        return storage;
    }

    function getProfile() {
        if (!storage) return;
        var p;

        try {
            p = JSON.parse(storage.aced_profile);
            // Need to merge in any undefined/new properties from last release
            // Meaning, if we add new features they may not have them in profile
            p = $.extend(true, profile, p);
        } catch (e) {
            p = profile
        }

        profile = p;
    }

    function updateProfile(obj) {
        if (!storage) return;
        storage.aced_profile = JSON.stringify($.extend(null, profile, obj));
    }

    function getEditorStorage() {
        if (!storage) return "";
        try {
            return JSON.parse(storage['aced_'+id]);
        } catch (e) {
            return "";
        }
    }

    function updateEditorStorage(content) {
        storage['aced_'+id] = JSON.stringify(content);
    }

    function initEditorStorage() {
        if ('aced_'+id in storage) return;
        storage['aced_'+id] = '';
    }

    function render(content) {
        if (options.mode == 'markdown') {
            var doc = WMD.convert(content);
            var html = doc.html;

            if (options.sanitize) {
                html = html_sanitize(html,
                    function(url) {
                        if(/^https?:\/\//.test(url)) {
                            return url
                        }
                    }, function(id){
                        return id;
                    }
                );
            }

            if (doc.metadata) {
                try {
                    var template = Handlebars.compile(html);
                    return template(doc.metadata);
                } catch (e) {
                    return html;
                }
            }
            return html;
        } else if (options.mode == 'html') {
            return content;
        } else {
            // Nothing to do for other modes
            return '';
        }
    }

    function resetProfile() {
        // For some reason, clear() is not working in Chrome.
        storage.clear();
        options.autoSave = false;
        delete storage.profile;
        // Now reload the page to start fresh
        window.location.reload();
    }

    function bindPreview() {
        editor.getSession().on('change', function (e) {
            previewMd();
        });
    }

    function bindKeyboard() {
        // CMD+s TO SAVE DOC
        key('command+s, ctrl+s', function (e) {
            submit();
            e.preventDefault();
        });

        var saveCommand = {
            name: "save",
            bindKey: {
                mac: "Command-S",
                win: "Ctrl-S"
            },
            exec: function () {
                submit();
            }
        };
        editor.commands.addCommand(saveCommand);
    }

    function val(val) {
        // Alias func
        if (val) {
            editor.getSession().setValue(val);
        }

        return editor.getSession().getValue();
    }

    function save() {
        updateEditorStorage(val());
    }

    function submit() {
        delete storage['aced_'+id];
        options.submit(val());
    }

    function autoSave() {
        if (options.autoSave && storage) {
            autoInterval = setInterval(function () {
                // firefox barfs if I don't pass in anon func to setTimeout.
                save();
            }, options.autoSaveInterval);

        } else {
            if (autoInterval){
                clearInterval(autoInterval)
            }
        }
    }

    function previewMd() {
        var unmd = val();
        var md = render(unmd);

        if (preview){
            preview.html('').html(md);
        }
        $('pre code', preview).each(function(i, e) {hljs.highlightBlock(e)});
    }

    function getScrollHeight($prevFrame) {
        // Different browsers attach the scrollHeight of a document to different
        // elements, so handle that here.
        if ($prevFrame[0].scrollHeight !== undefined) {
            return $prevFrame[0].scrollHeight;
        } else if ($prevFrame.find('html')[0].scrollHeight !== undefined &&
            $prevFrame.find('html')[0].scrollHeight !== 0) {
            return $prevFrame.find('html')[0].scrollHeight;
        } else {
            return $prevFrame.find('body')[0].scrollHeight;
        }
    }


    function syncPreview() {

        var editorScrollRange = (editor.getSession().getLength());

        var previewScrollRange = (getScrollHeight(preview));

        // Find how far along the editor is (0 means it is scrolled to the top, 1
        // means it is at the bottom).
        var scrollFactor = editor.getFirstVisibleRow() / editorScrollRange;

        // Set the scroll position of the preview pane to match.  jQuery will
        // gracefully handle out-of-bounds values.
        preview.scrollTop(scrollFactor * previewScrollRange);
    }


    function initSyncPreview() {
        if (!preview || !options.syncPreview) return;

        window.onload = function () {
            /**
             * Bind synchronization of preview div to editor scroll and change
             * of editor cursor position.
             */
            editor.session.on('changeScrollTop', syncPreview);
            editor.session.selection.on('changeCursor', syncPreview);
        };
    }

    function initProps() {
        if (typeof settings == 'string') {
            settings = { editor: settings };
        }

        $.extend(options, settings);

        if (options.editor) {
            element = toJquery(options.editor);
        }

        $.each(options, function(k, v){
            if (element.data(k)) {
                options[k] = element.data(k);
            }
        });

        if (options.preview) {
            preview = toJquery(options.preview);
        }

        if (!element.attr('id')) {
            // No id, make one!
            id = 'aced-' + Math.random().toString(36).substring(7);
            element.attr('id', id);
        } else {
            id = element.attr('id')
        }

        storage = hasLocalStorage();

        profile = {
            theme: 'idle_fingers'
        };
    }

    function initEditor() {
        initEditorStorage();
        editor = ace.edit(id);
        editor.setTheme('ace/theme/' + options.theme);
        editor.getSession().setMode('ace/mode/' + options.mode);
        editor.getSession().setValue(getEditorStorage() || val());
        editor.getSession().setUseWrapMode(true);
        editor.setShowPrintMargin(false);

        var $editor = toJquery(id);
        $editor.prepend('<div class="aced-button-bar aced-button-bar-top">' + buildThemeSelect().html() + '</div>');
        $editor.prepend('<div class="aced-button-bar aced-button-bar-bottom"><div class="btn btn-primary btn-xs aced-save">Save</div> </div>')
        $editor.find(".aced-save").click(function(){
           submit();
        });

        if (options.showButtonBar) {
            var $bar = $editor.find(".aced-button-bar");
            $bar.show();
            $editor.hover(function(){ $bar.show(); }, function() { $bar.hide(); });
        }

        if (options.keyMaster) {
            bindKeyboard();
        }

        if (preview) {
            bindPreview();
            previewMd();
        }
    }

    function init() {
        initProps();
        getProfile();
        initEditor();
        initSyncPreview();
        autoSave();
    }

    init();

    return {
        editor: editor,
        submit: submit,
        val: val
    };
}