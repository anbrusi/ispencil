// ispencil/ispencilsizecommand.js

import Command from '@ckeditor/ckeditor5-core/src/command';

export default class IsPencilSizeCommand extends Command {

	static get pluginName() {
		return 'IsPencilSizeCommand';
	}

    /**
     * Checks if an ispencil node is selected. If yes, the size is set to size.
     * 
     * @param {object} size an object with properties width and height
     */
    execute( size ) {
        console.log( 'Executing IsPencilSizeCommand with size', size );
        const model = this.editor.model;  
        const selection = model.document.selection;
        const widgetModelElement = selection.getSelectedElement();

        if ( widgetModelElement ) {
            const children = widgetModelElement.getChildren();
            let canvasModelElement = null;
            for ( let child of children ) {
                if ( child.name == 'isPencilCanvas' ) {
                    canvasModelElement = child;
                    break;
                }
            }
            if ( canvasModelElement ) {
                model.change( writer => {
                    writer.setAttributes( size, canvasModelElement );
                } );
            }
        }
    }

    refresh() {     
        const selection = this.editor.model.document.selection;
        const selectedElement = selection.getSelectedElement();
        if ( selectedElement ) {
            console.log( 'IspencilSizeCommand refresh ', selectedElement );
        }
        this.isEnabled = !!selectedElement;
    }
}