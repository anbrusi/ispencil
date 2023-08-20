// ispencil/ispencilposecommand.js

import Command from '@ckeditor/ckeditor5-core/src/command';

export default class IsPencilPosCommand extends Command {

	static get pluginName() {
		return 'IsPencilPosCommand';
	}

    /**
     * Checks if an ispencil node is selected. If yes, the position is set to position.
     * 
     * @param {string} position
     */
    execute( position ) {
        console.log( 'ispencilposcommend#execute position', position );
        const model = this.editor.model;  
        const selection = model.document.selection;
        const selectedModelElement = selection.getSelectedElement();

        if ( selectedModelElement ) {
            model.change( writer => {
                writer.setAttribute( 'position', position, selectedModelElement );
            } );
        }
    }

    refresh() {     
        const selection = this.editor.model.document.selection;
        const selectedElement = selection.getSelectedElement();

        this.isEnabled = !!selectedElement;
    }
}