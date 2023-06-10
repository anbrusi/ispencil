// isresize.js

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import IsResizer from './isresizer.js';
import { DomEmitterMixin, global } from '@ckeditor/ckeditor5-utils';
import { throttle } from 'lodash-es';

export default class IsResize extends Plugin {
    
    static get pluginName() {
        return 'IsResize';
    }

    /**
     * CKEditor works on three levels
     * ==============================
     * 
     *  1. Model
     * 
     *  2. View 
     *          It resembles the DOM. While the model’s tree structure only slightly resembled the DOM 
     *          (e.g. by introducing text attributes), the view is much closer to the DOM.
     *          In other words, it is a virtual DOM.
     *  3. DOM
     *          This is the real HTML DOM
     * 
     * 
     * The structure of a single IsPencil Elemet is as follows
     * -------------------------------------------------------
     * 
     * The outermost Element (widget) is at the different levels:
     * 
     *  1. 'no special name' --> an <isPencil> model node.
     *  2. 'viewElement' --> a <div> of class "ispcl-fitcontent"
     *  3. 'widgetWrapper' --> the DOM element corresponding to 'viewElement'
     * 
     * - viewElement [The outermost element consisting of a div of class "ispcl-fitcontent"]
     *         - dimensionHolder [The element determining width and height consisting of a canvas of class "ispcl-canvas"]
     * 
     */
    init() {
        // console.log( 'IsResize#init' );
        const editing = this.editor.editing;
        const domDocument = global.window.document;

        // Remove view widget-resizer mappings for widgets that have been removed from the document.
        // https://github.com/ckeditor/ckeditor5/issues/10156
        // https://github.com/ckeditor/ckeditor5/issues/10266
        this.editor.model.document.on('change', () => {
            for (const [viewElement, resizer] of this._resizers) {
                // isAttached() Returns true if the node is in a tree rooted in the document (is a descendant of one of its roots).
                if (!viewElement.isAttached()) {
                    this._resizers.delete(viewElement);
                    resizer.destroy();
                    console.log( 'check remotion of view element', viewElement )
                }
            }
        }, { priority: 'lowest' });

        editing.downcastDispatcher.on( 'selection', ( evt, data ) => {
            const modelSelection = data.selection;
            if ( !modelSelection.isCollapsed ) {
                const selectedModelElement = modelSelection.getSelectedElement();
                if ( selectedModelElement?.name == 'isPencil' ) {
                    // console.log( 'downcastDispatcher on selection of isPencil' );
                    // mapper gets the view document fragment corresponding to its argument 'modelDocumentFragment'
                    const viewElement = editing.mapper.toViewElement( selectedModelElement );
                   
                    let dimensionHolder = null;
                    const children = viewElement.getChildren();
                    for (let child of children) {
                        if (child.hasClass( 'ispcl-canvas' )) {
                            dimensionHolder = child;
                            break;
                        }
                    }
                    this._options = {};
                    this._options.viewElement = viewElement; // The widget element, a div of class "ispcl-fitcontent"
                    this._options.dimensionHolder = dimensionHolder; // The canvas, a canvas within viewElement
                    this._options.editor = this.editor;
                    // widgetWrapper is viewElement on DOM level
                    // Resize host is dimensionHolder on DOM level
                    this._options.getResizeHost = function( widgetWrapper ) {
                        const children = widgetWrapper.children;
                        for (let child of children) {
                            if (child.className == 'ispcl-canvas' ) {
                                return child;
                            }
                        }
                    };
                    // Handle host is viewElement on DOM level
                    this._options.getHandleHost = function( widgetWrapper ) {
                        return widgetWrapper; // In this implementation HandleHost is the widgetWrapper itself 
                    };
                    this._options.isCentered = function( widgetWrapper) {
                        if ( widgetWrapper._options.viewElement.hasClass( 'ispcl-centerpos' ) ) {
                            return true;
                        }
                        return false;
                    }
                    const resizer = this._attachTo( this._options );
                    // console.log( 'downcastDispatcher on selection built resizer' );
                }
            }
        } );

        
		this.set( 'selectedResizer', null );

		
		this.set( '_activeResizer', null );

        /**
	     * A map of resizers created using this plugin instance.
	    */
        this._resizers = new Map();

        this.listenTo( editing.view.document, 'mousedown', this._mouseDownListener.bind( this ), { priority: 'high' } );
        this._observer = new (DomEmitterMixin())();
        this._observer.listenTo(domDocument, 'mousemove', this._mouseMoveListener.bind(this));
        this._observer.listenTo(domDocument, 'mouseup', this._mouseUpListener.bind(this));

        this._redrawSelectedResizerThrottled = throttle(() => this.redrawSelectedResizer(), 200);
        // Redrawing on any change of the UI of the editor (including content changes).
        this.editor.ui.on('update', this._redrawSelectedResizerThrottled);
    }

    /**
     * Returns a resizer created for a given view element (widget element).
     *
     * @param {module:engine/view/containerelement~ContainerElement} viewElement View element associated with the resizer.
     * @returns {module:ispencil/resize/isresizer~IsResizer|undefined}
     */
    getResizerByViewElement(viewElement) {
        return this._resizers.get(viewElement);
    }
    
    /**
     * Marks resizer as selected.
     *
     * @param {module:ispencil/resize/isresizer~IsResizer} resizer
     */
    select(resizer) {
        this.deselect();
        this.selectedResizer = resizer;
        this.selectedResizer.isSelected = true;
    }

    /**
     * Deselects currently set resizer.
     */
    deselect() {
        if (this.selectedResizer) {
            this.selectedResizer.isSelected = false;
        }
        this.selectedResizer = null;
    }

    /**
     * Redraws the selected resizer if there is any selected resizer and if it is visible.
     */
    redrawSelectedResizer() {
        // console.log( 'Isresize#redrawSelectedresizer', this.selectedResizer );
        // selectedResizer.isVisible is set in IsRezizer by binding isVisible to (isEnabled, isSelected) => isEnabled && isSelected
        if (this.selectedResizer && this.selectedResizer.isVisible) {
            // console.log( 'IsResize redraw selected resizer')
            this.selectedResizer.redraw();
        }
    }

	_attachTo( options ) {
        console.log(' IsResize#_attachTo with options', options );
        let resizer = null;
        if ( this._hasResizer( options.viewElement ) ) {
            resizer = this.getResizerByViewElement( options.viewElement );
            console.log( 'IsResize#_attachTo found an existing resizer', resizer );
        } else {
            resizer = new IsResizer( options );
            resizer.attach();
            this._resizers.set( options.viewElement, resizer );
            console.log( 'IsResize#_attachTo registered a new resizer', resizer );
        }
        const viewSelection = this.editor.editing.view.document.selection;
        const selectedElement = viewSelection.getSelectedElement();
        // If the element the resizer is created for is currently focused, it should become visible.
        if (this.getResizerByViewElement(selectedElement) == resizer) {
            this.select(resizer);
        }
        console.log( 'IsResize instance after _attachTo', this );
        return resizer;
    }

    /**
     * This listener reacts only to mouseDown on a resize handle
     * 
     * @protected
     * @param {module:utils/eventinfo~EventInfo} event
     * @param {Event} domEventData Native DOM event.
     */
    _mouseDownListener( event, domEventData ) {
        // console.log( 'mousedown event:', event );
        // console.log( 'domEventData', domEventData );
        const resizeHandle = domEventData.domTarget;
        if (!IsResizer.isResizeHandle(resizeHandle)) {
            // console.log( 'mousedown is not on resize handle' );
            return;
        }
        this._activeResizer = this._getResizerByHandle(resizeHandle) || null;
        console.log( 'activ resizer', this._activeResizer );
        if (this._activeResizer) {
            this._activeResizer.begin(resizeHandle);
            // Do not call other events when resizing. See: #6755.
            event.stop();
            domEventData.preventDefault();
        }
    }

    /**
     * @protected
     * @param {module:utils/eventinfo~EventInfo} event
     * @param {Event} domEventData Native DOM event.
     */
    _mouseMoveListener(event, domEventData) {
        if (this._activeResizer) {
            this._activeResizer.updateSize(domEventData);
        }
    }

    /**
     * @protected
     */
    _mouseUpListener() {
        console.log( 'mouseUp' );
        if (this._activeResizer) {
            this._activeResizer.commit();
            this._activeResizer = null;
        }
    }

    _hasResizer( viewElement ) {
        // console.log( '_hasResizer viewElement', viewElement );
        const children = viewElement.getChildren();
        for (let child of children) {
            // console.log( 'child', child );
            if (child.name == 'div' && child.hasClass( 'ck-widget__resizer' ) ) {
                // console.log( 'div detected in', child );
                return true;
            }
        };
        return false;
    }

    /**
     * Returns a resizer that contains a given resize handle.
     *
     * @protected
     * @param {HTMLElement} domResizeHandle
     * @returns {module:widget/widgetresize/resizer~Resizer}
     */
    _getResizerByHandle(domResizeHandle) {
        for (const resizer of this._resizers.values()) {
            if (resizer.containsHandle(domResizeHandle)) {
                return resizer;
            }
        }
    }
}