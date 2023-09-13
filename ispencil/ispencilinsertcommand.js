//ispencil5/ispencilinsertcommand

import Command from '@ckeditor/ckeditor5-core/src/command';
import uid from '@ckeditor/ckeditor5-utils/src/uid';

/**
 * This will be recorded as data-ispcl-version in the dom canvas and in the view, as version in the model.
 * The purpose is to inshure backward compatibility, when new features are added
 */
const version = '1.0';

export default class IsPencilInsertCommand extends Command {

    /**
     * Inserts an isPencil element in the editor. 
     * Takes the configuration from this.editor.config, which in turn takes it from ClassicEditor.defaultConfiguration in ckeditor.js
     * The default configuration can be overridden in the instantiation of ClassicEditor e.g. in index.php
     */
    execute() {
        const config = this.editor.config;
        const configuration = {
            isPencil: {
                hasBorder: config.get( 'isPencil.hasBorder' ),
                position: config.get( 'isPencil.position' )
            },
            isPencilCanvas: {
                width: config.get( 'isPencil.width' ),
                height: config.get( 'isPencil.height' ),
                version: version
            }
        };

        this.editor.model.change( writer => {
            const isPencil = createIsPencil( writer, configuration );
            this.editor.model.insertObject( isPencil );
        } );
    }

    refresh() {
        const model = this.editor.model;
        const selection = model.document.selection;
        const allowedIn = model.schema.findAllowedParent( selection.getFirstPosition(), 'isPencil' );

        this.isEnabled = allowedIn !== null;
    }
}

function createIsPencil( writer, configuration ) {
    const isPencil = writer.createElement( 'isPencil', configuration.isPencil );
    let canvasConfiguration = configuration.isPencilCanvas;
    canvasConfiguration['uid'] = uid();
    canvasConfiguration['content'] = JSON.stringify([]); // This is an empty segmentArray
    const isPencilCanvas = writer.createElement( 'isPencilCanvas', canvasConfiguration );
    writer.append( isPencilCanvas, isPencil );
    return isPencil;
}