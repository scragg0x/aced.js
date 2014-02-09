function Aced(settings) {
    var id, options, editor, element, preview, profile, autoInterval, storage;

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
        keymaster: false
    };

    profile = {
        theme: 'idle_fingers'
    };

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

    // Convert markdown to HTML
    function render(md) {

        var doc = WMD.convert(md);
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
            save(true);
            e.preventDefault();
        });

        var saveCommand = {
            name: "save",
            bindKey: {
                mac: "Command-S",
                win: "Ctrl-S"
            },
            exec: function () {
                save(true);
            }
        };
        editor.commands.addCommand(saveCommand);
    }

    function initEditor() {
        initEditorStorage();
        editor = ace.edit(id);
        editor.setTheme('ace/theme/' + options.theme);
        editor.getSession().setMode('ace/mode/' + options.mode);
        editor.getSession().setValue(getEditorStorage() || editor.getSession().getValue());
        editor.getSession().setUseWrapMode(true);
        editor.setShowPrintMargin(false);

        if (options.keymaster) {
            bindKeyboard();
        }

        if (preview) {
            bindPreview();
            previewMd();
        }
    }

    function save(isManual) {
        updateEditorStorage(editor.getSession().getValue());

        if (isManual) {
            delete storage['aced_'+id];

            var data = {
                //name: $pagename.val(),
                //message: $("#page-message").val(),
                content: editor.getSession().getValue()
            };

            $.post(window.location, data, function () {
                location.href = url_prefix + '/' + data['name'];
            });
        }
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
        var unmd = editor.getSession().getValue();
        var md = render(unmd);

        if (preview){
            preview.html('').html(md);
        }
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
            // TODO FIX THIS
            var $loading = $('#loading');

            if ($.support.transition) {
                $loading
                    .bind($.support.transitionEnd, function () {
                        $('#main').removeClass('bye');
                        $loading.remove();
                    })
                    .addClass('fade_slow');
            } else {
                $('#main').removeClass('bye');
                $loading.remove();
            }

            /**
             * Bind synchronization of preview div to editor scroll and change
             * of editor cursor position.
             */
            editor.session.on('changeScrollTop', syncPreview);
            editor.session.selection.on('changeCursor', syncPreview);
        };
    }

    function initProps() {
        $.extend(options, settings);

        if (options.preview) {
            preview = toJquery(options.preview);
        }

        if (options.editor) {
            element = toJquery(options.editor);
        }

        if (!element.attr('id')) {
            // No id, make one!
            id = 'aced-' + Math.random().toString(36).substring(7);
            element.attr('id', id);
        } else {
            id = element.attr('id')
        }

        storage = hasLocalStorage();
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
        editor: editor
    };
}