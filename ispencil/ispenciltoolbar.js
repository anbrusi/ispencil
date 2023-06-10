// ispencil/ispenciltoolbar.js

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import WidgetToolbarRepository from '@ckeditor/ckeditor5-widget/src/widgettoolbarrepository';
import { isWidget } from '@ckeditor/ckeditor5-widget/src/utils';

export default class IsPencilToolbar extends Plugin {
    static get requires() {
        return [ WidgetToolbarRepository ];
    }

	static get pluginName() {
		return 'IsPencilToolbar';
	}

    init() {
        // The following properties are made observable and are set to be initially false
        // They indicate which position is currently active and are modified by the selection
        // obtained listening to the editor.editing,downcastDispatcher
        this.set( 'leftPosActive', false );
        this.set( 'centerPosActive', false );
        this.set( 'rightPosActive', false );

        this.editor.editing.downcastDispatcher.on( 'selection', ( evt, data ) => {
            const modelSelection = data.selection;
            if ( !modelSelection.isCollapsed ) {
                const selectedModelElement = modelSelection.getSelectedElement();
                if ( selectedModelElement?.name == 'isPencil' ) {
                    const currentPosition = selectedModelElement.getAttribute( 'position' );
                    // console.log( 'downcast dispatcher set position', currentPosition );
                    this.leftPosActive = false;
                    this.centerPosActive = false;
                    this.rightPosActive = false;
                    if ( currentPosition == 'left' ) {
                        this.leftPosActive = true;
                    }
                    if ( currentPosition == 'center' ) {
                        this.centerPosActive = true;
                    }
                    if ( currentPosition == 'right' ) {
                        this.rightPosActive = true;
                    }
                }
            }
        } );
    }

    afterInit() {
        const editor = this.editor;
        const t = editor.t;
        const widgetToolbarRepository = editor.plugins.get( WidgetToolbarRepository );

        widgetToolbarRepository.register( 'isPencilToolbar', {
			ariaLabel: t( 'IsPencil toolbar' ),
            items: editor.config.get( 'isPencil.toolbar' ),
            // getRelatedElement is a callback receiving a selection and returning
            // the view element to which the toolbar is attached or null
            getRelatedElement: this.getIsPencilViewElement
        } );
    }

    /**
     * Returns the view Element to which the baloon toolbar should be attached
     * by examining the selection. If the selection does not yeld any view element, null is returned
     * 
     * @param {@ckeditor/ckeditor5-engine/src/view/selection} selection 
     * @returns the widget or null
     */
    getIsPencilViewElement( selection ) {
        const selectedElement = selection.getSelectedElement();
        if ( !selectedElement ) {
            return null;
        }
        if ( isWidget(selectedElement) && selectedElement.hasClass( 'ispcl-fitcontent' )) {
            return selectedElement;
        }
    }
}