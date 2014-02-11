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
        autoSaveInterval: 5000,
        syncPreview: true,
        keyMaster: false,
        submit: function(data){ alert(data); },
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

    function editorId(){
        return "aced_" + id;
    }
    function buildThemeSelect() {
        var $sel = $("<select class='aced-theme-sel' data-placeholder='Theme'></select>");
        $sel.append('<option></option>');
        $.each(themes, function(k, v) {
           $sel.append("<option value='" + k + "'>" + v + "</option>");
        });
        return $("<div/>").html($sel);
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

    function initProfile() {
        storage = hasLocalStorage();

        if (!storage) return;

        var p;
        profile = {theme:''};

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
        profile = $.extend(null, profile, obj);
        storage['aced_profile'] = JSON.stringify(profile);
    }

    function getEditorStorage() {
        if (!storage) return "";
        try {
            return JSON.parse(storage[editorId()]);
        } catch (e) {
            return "";
        }
    }

    function updateEditorStorage(content) {
        storage[editorId()] = JSON.stringify(content);
    }

    function initEditorStorage() {
        if (editorId() in storage) return;
        storage[editorId()] = '';
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
        delete storage.aced_profile;
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
        delete storage[editorId()];
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

    function setTheme(theme) {
        editor.setTheme('ace/theme/'+theme);
        updateProfile({theme: theme});
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

        if ('theme' in profile) {
            settings['theme'] = profile['theme'];
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
    }

    function initEditor() {
        initEditorStorage();
        editor = ace.edit(id);
        editor.setTheme('ace/theme/' + options.theme);
        editor.getSession().setMode('ace/mode/' + options.mode);
        editor.getSession().setValue(getEditorStorage() || val());
        editor.getSession().setUseWrapMode(true);
        editor.setShowPrintMargin(false);

        if (options.showButtonBar) {
            var $editor = toJquery(id);
            var $btnBar = $('<div class="aced-button-bar aced-button-bar-top">' + buildThemeSelect().html() + ' <button type="button" class="btn btn-primary btn-xs aced-save">Save</button></div>')
            $editor.before($btnBar);

            $(".aced-save", $btnBar).click(function(){
                submit();
            });

            if ($.fn.chosen) {
                $('select', $btnBar).chosen().change(function(){
                    setTheme($(this).val());
                });
            }
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
        initProfile();
        initProps();
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