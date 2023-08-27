// isresizing.js

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import { Template } from '@ckeditor/ckeditor5-ui';

export default class IsResizing extends Plugin {

    init() {
        /**
         * This is the current widget on which the methods of this class act
         */
        this._widgetViewElement = null;

        this._selectedModelElement = null;

        // Resizer dimensions and visibility must be set in a selection handler and not as a reaction
        // to canvas mouse clicks, because a click on a positioning handle would not handle the resizer
        this.editor.editing.downcastDispatcher.on( 'selection', (evt, data) => {
            // console.log( 'On selection' );
            const selectedModelElement = data.selection.getSelectedElement();
            if ( selectedModelElement?.name == 'isPencil' ) {
                if ( this._selectedModelElement ) {
                    // There was an old selected model element. Hide the resizer
                    this.setCurrentWidget( this._selectedModelElement );
                    this.hideResizer();
                }
                // A new model element is selected. Sync and show the resizer
                this._selectedModelElement = selectedModelElement;
                this.setCurrentWidget( selectedModelElement );
                this.syncResizerDim();
                this.showResizer();
            } else {
                // Deselect only
                if ( this._selectedModelElement ) {
                    this.setCurrentWidget( this._selectedModelElement );
                    this.hideResizer();
                }
            }
        } );
        this.editor.ui.on( 'update', () => {
            // console.log( 'editor.ui update fired' )
        } );

        // this.listenTo( this.editor.editing.view.document, 'mousedown', this._mouseDownListener.bind( this ), { priority: 'high' } );
    }

    createResizer( viewWriter ) {
        const resizerViewElement = viewWriter.createUIElement('div', {
            class: 'ck ck-reset_all ck-widget__resizer'
        }, function (domDocument) {
            // console.log( 'custom render function domDocument', domDocument );
            // domDocument is the whole HTML document (the entire displayed page), not only the editor or part of it
            const domElement = this.toDomElement(domDocument);
            // domElement is the just created resizer div
            console.log( 'custom render function domElement', domElement );
            const resizerPositions = ['bottom-right', 'bottom-left'];
            for (const currentPosition of resizerPositions) {
                let handle = new Template({
                    tag: 'div',
                    attributes: {
                        class: `ck-widget__resizer__handle ${getResizerClass(currentPosition)}`
                    }
                }).render();
                domElement.appendChild( handle );
            }
            return domElement;
        } );
        return resizerViewElement;
    }

    /**
     * Sets the current widget view element from a widget model element
     * 
     * @param {model element} widgetModelElement 
     */
    setCurrentWidget( widgetModelElement ) {        
        this._widgetViewElement = this.editor.editing.mapper.toViewElement( widgetModelElement );
    }

    /**
     * If there is a current widge view element this method syncs resizer width and height to canvas width and height
     * If this._widgetViewElement === null, this method has no effect
     */
    syncResizerDim() {
        const canvasViewElement = this.getChildByClass( 'ispcl-canvas' );
        const resizerViewElement = this.getChildByClass( 'ck-widget__resizer' );
        console.log( 'resizer', resizerViewElement );
        if ( canvasViewElement && resizerViewElement ) {
            this.editor.editing.view.change( viewWriter => {
                let width = canvasViewElement.getAttribute( 'width' ) + 'px';
                let height = canvasViewElement.getAttribute( 'height' ) + 'px';
                viewWriter.setStyle('width', width, resizerViewElement );
                viewWriter.setStyle( 'height', height, resizerViewElement );
            } );
        }
    }

    /**
     * Shows the resizer if this.widgetViewElement != null, has no effect else
     */
    showResizer() {
        const resizerViewElement = this.getChildByClass( 'ck-widget__resizer' );
        console.log( 'resizer', resizerViewElement );
        if ( resizerViewElement ) {
            this.editor.editing.view.change( viewWriter => {
                viewWriter.setStyle( 'display', 'block', resizerViewElement );
            } );
        }
    }

    /**
     * Hides the resizer if this.widgetViewElement != null, has no effect else
     */
    hideResizer() {
        const resizerViewElement = this.getChildByClass( 'ck-widget__resizer' );
        console.log( 'resizer', resizerViewElement );
        if ( resizerViewElement ) {
            this.editor.editing.view.change( viewWriter => {
                viewWriter.setStyle( 'display', 'none', resizerViewElement );
            } );
        }
    }

    /**
     * Returns a child view of this._widgetViewElement having class classname or null if there is none
     * 
     * @param {string} className 
     * @returns 
     */
    getChildByClass( className ) {
        if ( this._widgetViewElement === null ) {
            return null;
        }
        const children = this._widgetViewElement.getChildren();
        for ( let child of children ) {
            if ( child.hasClass( className ) ) {
                return child;
            }
        }
        return null;
    }

    _mouseDownListener( event, domEventData ) {
        const domTarget = domEventData.domTarget;
        // console.log( 'isresizing mouse down on target', domTarget );
        if ( isResizerHandle( domTarget ) ) {
            console.log( 'clicked handle' );
            event.stop();
            domEventData.preventDefault();
        }
    }
}

// @private
// @param {String} resizerPosition Expected resizer position like `"top"`, `"bottomt"`.
// @returns {String} A prefixed HTML class name for the resizer element
function getResizerClass(resizerPosition) {
    // return `is-widget__resizer__handle-${resizerPosition}`;
    return `ck-widget__resizer__handle-${resizerPosition}`;
}

function isResizerHandle( domElement ) {
    return domElement?.classList.contains( 'ck-widget__resizer__handle' );
}