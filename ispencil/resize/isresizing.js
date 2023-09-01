// isresizing.js

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import { Template } from '@ckeditor/ckeditor5-ui';
import { DomEmitterMixin, global } from '@ckeditor/ckeditor5-utils';

export default class IsResizing extends Plugin {

    init() {
        const domDocument = global.window.document;

        /**
         * This is the current widget on which the methods of this class act
         */
        this._widgetViewElement = null;

        /**
         * The last selected widget model element or null. Used to hide resizer on no longer selected widgets
         */
        this._selectedModelElement = null;

        /**
         * true if a resizer is active, false else
         */
        this._activeResizer = false;

        /**
         * One of 'left' or 'right' if a resizer is active, depending on which handle made it active
         */
        this._handlePosition = null;

        /**
         * The reference size (initial size) during resizing
         */
        this._originalResizerSize; 

        /**
         * The current resizer size. This will be taken as new size on mouseup in resizing
         */
        this._proposedSize;

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

        this.listenTo( this.editor.editing.view.document, 'mousedown', this._mouseDownListener.bind( this ), { priority: 'high' } );
        this._observer = new (DomEmitterMixin())();
        this._observer.listenTo(domDocument, 'mousemove', this._mouseMoveListener.bind(this));
        this._observer.listenTo(domDocument, 'mouseup', this._mouseUpListener.bind(this));
    }

    createResizer( viewWriter, position ) {
        const resizerViewElement = viewWriter.createUIElement('div', {
            class: 'ck ck-reset_all ck-widget__resizer'
        }, function (domDocument) {
            const domElement = this.toDomElement(domDocument);
            // domElement is the just created resizer div in the dom
            console.log( 'custom render function domElement', domElement );
            let rightHandle = new Template( {
                tag: 'div',
                attributes: {
                    class: 'ck-widget__resizer__handle ck-widget__resizer__handle-bottom-right'
                }
            } ).render();
            let leftHandle = new Template( {
                tag: 'div',
                attributes: {
                    class: 'ck-widget__resizer__handle ck-widget__resizer__handle-bottom-left'
                }
            } ).render();
            switch ( position ) {
                case 'left':
                    domElement.appendChild( rightHandle );
                    break;
                case 'right':                    
                    domElement.appendChild( leftHandle );
                    break;
                case 'center':             
                    domElement.appendChild( leftHandle );
                    domElement.appendChild( rightHandle );
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
     * If there is a current widget view element this method syncs resizer width and height to canvas width and height
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
        // Do not compare to null, because this.setCurrentWidget might return undefined
        if ( !this._widgetViewElement ) {
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

    /**
     * Callback to an observeble
     * 
     * @param {*} event 
     * @param {*} domEventData 
     */
    _mouseDownListener( event, domEventData ) {
        const domTarget = domEventData.domTarget;
        // console.log( 'isresizing mouse down on target', domTarget );
        if ( isResizerHandle( domTarget ) ) {
            // console.log( 'clicked handle' );
            event.stop();
            domEventData.preventDefault();
            this._activeResizer = true;
            this._handlePosition = handlePosition( domTarget );
            this._originalCoordinates = extractCoordinates(domEventData.domEvent);
            this._originalResizerSize = this._getResizerSize();
            // console.log( 'originalCoordinates', this._originalCoordinates );
        }
    }

    _mouseUpListener( event, domEventData ) {
        if ( this._activeResizer ) {
            // console.log ( 'new size on mouseup', this._proposedSize );
            this._activeResizer = false;
            const canvasModelElement = this._selectedModelElement.getChild(0);
            this.editor.model.change( writer => {
                writer.setAttributes({
                    height: this._proposedSize.height,
                    width: this._proposedSize.width
                }, canvasModelElement );
            } );
        }
    }

    /**
     * Callback to a DomEmitterMixin
     * 
     * @param {*} event 
     * @param {*} domEventData 
     */
    _mouseMoveListener( event, domEventData ) {
        if ( this._activeResizer ) {
            // console.log( 'event', event );
            // console.log( 'domEventData', domEventData );
            const newCoordinates = extractCoordinates(domEventData);
            this._proposedSize = this._proposeNewSize( newCoordinates );
            console.log( 'proposedNewSize', this._proposedSize );
            const resizerViewElement = this.getChildByClass( 'ck-widget__resizer' );
            this.editor.editing.view.change( (writer) => {
                writer.setStyle( {
                    width: this._proposedSize.width + 'px',
                    height: this._proposedSize.height + 'px'
                },  this._widgetViewElement );
                writer.setStyle( {
                    width: this._proposedSize.width + 'px',
                    height: this._proposedSize.height + 'px'
                },  resizerViewElement )
            } );
        }
    }

    _getResizerSize( ) {
        const resizerViewElement = this.getChildByClass( 'ck-widget__resizer' );
        if ( resizerViewElement ) {
            return {
                width: parseInt( resizerViewElement.getStyle( 'width' ) ),
                height: parseInt( resizerViewElement.getStyle( 'height' ) )
            }
        }
    }

    /**
     * Returns the size of the resizer from page coordinates 'newCoordinates' of the mouse
     * 
     * @param {point} newCoordinates 
     * @returns 
     */
    _proposeNewSize( newCoordinates ) {
        let dx = newCoordinates.x - this._originalCoordinates.x;
        let dy = newCoordinates.y - this._originalCoordinates.y;
        if ( this._handlePosition == 'left' ) {
            dx = - dx;
        }
        if ( this._widgetViewElement.hasClass( 'ispcl-centerpos' ) ) {
            dx *= 2;
        }
        let newSize = {
            width: this._originalResizerSize.width + dx,
            height: this._originalResizerSize.height + dy
        }
        return newSize;
    }
}

function isResizerHandle( domElement ) {
    return domElement?.classList.contains( 'ck-widget__resizer__handle' );
}

/**
 * Returns one of 'left', 'right' if domElement is a resizer handle, null if it is not
 * 
 * @param {HTML dom element} domElement 
 * @returns 
 */
function handlePosition( domElement ) {
    if ( domElement?.classList.contains( 'ck-widget__resizer__handle-bottom-left' ) ) {
        return 'left';
    }
    if ( domElement?.classList.contains( 'ck-widget__resizer__handle-bottom-right' ) ) {
        return 'right';
    }
    return null;
}

/**
 * Returns mouse page coordinates from a maouse event 'event'
 * 
 * @param {dom mouse event} event 
 * @returns 
 */
function extractCoordinates(event) {
    return {
        x: event.pageX,
        y: event.pageY
    };
}