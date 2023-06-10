//ispencil5/ispencilinsertcommand

import Command from '@ckeditor/ckeditor5-core/src/command';

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
                height: config.get( 'isPencil.height' )
            }
        };

        this.editor.model.change( writer => {
            this.editor.model.insertContent( createIsPencil( writer, configuration ) );
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
    const isPencilCanvas = writer.createElement( 'isPencilCanvas', configuration.isPencilCanvas );
    writer.append( isPencilCanvas, isPencil );
    return isPencil;
}