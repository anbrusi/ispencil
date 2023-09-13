// ispencil/ispencilposecommand.js

import Command from '@ckeditor/ckeditor5-core/src/command';
import IsCanvas from './ispen/iscanvas';

export default class IsPencilPosCommand extends Command {

    isCanvas = this.editor.plugins.get( IsCanvas );

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
        // If the position changes, the model is downcated again, so it must be kept up to date
        const selectedModelElement = this.isCanvas.selectedWidgetModelElement();
        if ( selectedModelElement ) {
            /*
            const canvasModelElement = selectedModelElement.getChild(0);
            this.isCanvas.closeCanvas( canvasModelElement );
            */
            this.editor.model.change( writer => {
                writer.setAttribute( 'position', position, selectedModelElement );
            } );
        }
    }

    refresh() {     
        console.log( 'IsPencilPosCommand#refresh' );
        const selection = this.editor.model.document.selection;
        const selectedModelElement = selection.getSelectedElement();
        this.isEnabled = !!selectedModelElement;
    }
}