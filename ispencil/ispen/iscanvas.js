// ispen/iscanvas.js

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import { DomEmitterMixin, global } from '@ckeditor/ckeditor5-utils';
import { logError } from '@ckeditor/ckeditor5-utils/src/ckeditorerror';
import IsPencilEditing from '../ispencilediting';

export default class IsCanvas extends Plugin {

    /**
     * The structure of data in the JSON od data-ispcl-content is
     * 
     * - segmentArray an array of segments
     *      - segment is an object with properties 'width', 'color' 'stepType', 'pts'
     */

    static get pluginName() {
        return 'IsCanvas';
    }

    init() {
        console.log( 'IsCanvas#init' );
        const domDocument = global.window.document;
        // Plugins are Observable, but this.ListenTo would not do, since we need a DomEmitterMixin, not just a an EmitterMixin
        // DOM emitter mixin is by default available in the View class, but it can also be mixed into any other class:
        this._observer = new (DomEmitterMixin())();
        this.editor.on('ready', () => {   
            // The retrieval of editorClientArea did not work in init outside of this callback, because init is called before
            // the HTML collection can be queried.       
            const collection = domDocument.getElementsByClassName( 'ck-editor__main' );
            /*
            console.log( 'collection', collection );
            for ( let item of collection ) {
                console.log( 'collection item', item );
            }
            */
            const editorClientArea = collection[ 0 ];
            if ( editorClientArea ) {
                this._observer.listenTo( editorClientArea, 'pointerdown', this._pointerdownListener.bind( this ) );
                this._observer.listenTo( editorClientArea, 'pointermove', this._pointermoveListener.bind( this ) );
                this._observer.listenTo( editorClientArea, 'pointerup', this._pointerupListener.bind( this ) );
            }
        } );
        /* this worked, but could cause problems on pages displaying isPencil widgets outside of the editor
        this._observer.listenTo( domDocument, 'pointerdown', this._pointerdownListener.bind( this ) );
        this._observer.listenTo( domDocument, 'pointermove', this._pointermoveListener.bind( this ) );
        this._observer.listenTo( domDocument, 'pointerup', this._pointerupListener.bind( this ) );
        */ 

        this.isPencilEditing = this.editor.plugins.get( IsPencilEditing );

        /**
         * This is the canvas view element after a pointer down on its canvas has been processed
         */
        this._currentCanvasViewElement = null;

        // These are the handlers for the default mode 
        this._pointerDownH = this._freePenPointerDownH;
        this._pointerMoveH = this._freePenPointerMoveH;
        this._pointerUpH = this._freePenPointerUpH;
         
        // The following are initial values, current values are set 
        this.color = 'black';
        this.stroke = 'medium';

        // The pointer is down on a canvas for ispencil use
        this.pointerDown = false;

        // Step type is either 'L' for lines or 'B' for Bezier curves
        this.stepType = 'L';

        /**
         * this.segmentArray is loaded by this._openCanvas  and stored by this._closeCanvas
         * 
         * this.currSegment is set by this._newSegment
         * 
         * this.ctx is the 2d drawing context of the current canvas. It is set by this._openCanvas
         */

        
        /**
         * Minimal square distance between two registered points
         */
        this.minDist2 = 20;
    }

    /**
     * Maps a HTML DOM Element to a CKEDITOR model element.
     * 
     * @param {HTML DOM element} domElement 
     * @returns 
     */
    domToModel( domElement ) {
        // dom to view
        const viewElement = this.editor.editing.view.domConverter.mapDomToView( domElement );
        if ( viewElement ) {
            // view to model
            const modelElement = this.editor.editing.mapper.toModelElement( viewElement );
            if ( modelElement ) {
                return modelElement;
            }
        }
    }

    /**
     * Called in IsPencilUI when the mode observable changes
     * 
     * @param {string} newMode 
     */
    changeMode( newMode ) {
        console.log( 'IsCanvas mode changed to', newMode );
        switch (newMode) {
            case 'freePen':
                this._pointerDownH = this._freePenPointerDownH;
                this._pointerMoveH = this._freePenPointerMoveH;
                this._pointerUpH = this._freePenPointerUpH;
                break;
            case 'straightLine':
                this._pointerDownH = this._straightLinesPointerDownH;
                this._pointerMoveH = this._straightLinesPointerMoveH;
                this._pointerUpH = this._straightLinesPointerUpH;
                break;
            case 'erase':
                this._pointerDownH = this._erasePointerDownH;
                this._pointerMoveH= this._erasePointerMoveH;
                this._pointerUpH = this._erasePointerUpH;
        }
    }

    /**
     * Called in IsPencilUi when the color changes
     * 
     * @param {string} newColor 
     */
    changeColor( newColor ) {
        this.color = newColor;
        if (this._currentCanvasViewElement) {
            this.ctx.strokeStyle = this.color;
        }
    }

    /**
     * Called in IsPencilUi when the stroke width changes. 
     * newStroke is one of the witdth names enumerated in _lineWidthFromStroke
     * 
     * @param {string} newStroke 
     */
    changeStroke( newStroke ) {
        this.stroke = newStroke;
        if (this._currentCanvasViewElement) {
            this.ctx.lineWidth = _lineWidthFromStroke( this.stroke );
        }
    }

    /**
     * Sets the selection on the ispencil widget, if such a widget is clicked 
     * and delegates the whole drawing handling to this._pointerDown
     * 
     * @param {*} event 
     * @param {native dom event} domEventData 
     */
    _pointerdownListener(event, domEventData) {
        const srcElement = domEventData.srcElement;
        if (srcElement.hasAttribute( 'data-ispcl-content' )) {
            // Pointer went down on canvas
            const canvasViewElement = this.editor.editing.view.domConverter.mapDomToView(srcElement);
            console.log( 'canvasViewElement', canvasViewElement );
            let canvas = srcElement;
            // Check if it is the current canvas
            if ( this._currentCanvasViewElement && 
                 canvasViewElement.getAttribute( 'data-ispcl-uid') == this._currentCanvasViewElement.getAttribute( 'data-ispcl-uid') ) {
                // Pointerdown on the current canvas
                if ( canvasViewElement.hasClass( 'ispcl-inactive') ) {
                    // Pointerdown on current canvas, which is not active. Make it active and start painting
                    if ( this._allowedPointer(domEventData) ) {
                        // The background must be changed before opening the canvas. Otherwise it is not found
                        this._setCanvasInactiveBackground( canvasViewElement, false );
                        this._openCanvas( canvasViewElement );
                        this._pointerDownH(event, domEventData);
                    } else {
                        // An active canvas was touched with a finger. Do nothing
                    }                    
                } else {
                    // Ponterdown on current already active canvas. Start a segment
                    if ( this._allowedPointer(domEventData) ) {
                        console.log('start painting on canvas', this._activeUid);
                        this._pointerDownH(event, domEventData);
                    } else {
                        // An active canvas was touched with a finger. Do nothing
                    }
                }
            } else {
                // Pointer down on non current canvas. Close a possibly active current canvas and make the new one current
                this._setCanvasInactiveBackground( canvasViewElement, true );
                if ( this._currentCanvasViewElement ) {
                    // A previous canvas exists
                    if (this._isInactiveCanvas( this._currentCanvasViewElement )) {
                        this._setCanvasInactiveBackground( this._currentCanvasViewElement, false );
                    } else {
                        this._closeCanvas( this._currentCanvasViewElement );
                    }
                }
                this.isPencilEditing.isResizing.setCurrentWidget(canvasViewElement );
                this._currentCanvasViewElement = canvasViewElement;
            }
        } else {
            // Pointerdown outside of canvas. There is no current canvas any more
            // The Background must be changed, before closing the canvas. Closing makes changes that prevent finding the canvas
            if (this._currentCanvasViewElement) {
                if (this._isInactiveCanvas( this._currentCanvasViewElement )) {
                    this._setCanvasInactiveBackground( this._currentCanvasViewElement, false );
                } else {
                    // Do not close an active canvas. If You click on another canvas while drawing the other canvas will not be opened
                    // leaving the sgmantArray of the previous canvas intact. So a close would store the old content to the second canvas.
                    this._closeCanvas( this._currentCanvasViewElement );
                }
            }
            this._currentCanvasViewElement = null;
            this.isPencilEditing.isResizing.setCurrentWidget( this._currentCanvasViewElement );
        }
    }

    _pointermoveListener(event, domEventData) {
        const srcElement = domEventData.srcElement;
        if (srcElement.hasAttribute( 'data-ispcl-content' )) {
            // console.log('pointerMove on canvas', srcElement); 
            if (this._allowedPointer(domEventData) && this._currentCanvasViewElement) {
                this._pointerMoveH(event, domEventData);
            }
        }  
    }    

    _pointerupListener(event, domEventData) {
        const srcElement = domEventData.srcElement;
        if (srcElement.hasAttribute( 'data-ispcl-content' )) {
            // Pointer up in a canvas
        } else {
            // Pointer up outside of any canvas
        }
        this._pointerUpH(event, domEventData);
    }

    /**
     * The pencil specific part of _pointerdownListener used in drawing mode
     * 
     * @param {*} event 
     */
    _freePenPointerDownH(event, domEventData) {        
        if (this._allowedPointer(domEventData) && !this.pointerDown) {
            domEventData.preventDefault();
            const canvasDomElement = this.editor.editing.view.domConverter.mapViewToDom( this._currentCanvasViewElement );
            this.pointerDown = true;
            if (domEventData.pointerType == 'mouse') {
                canvasDomElement.style.cursor = 'crosshair';
            } else {
                canvasDomElement.style.cursor = 'none';
            }
            this.lastPos = this._canvasPos(domEventData);
            this._newSegment(this.lastPos); // Initializes temporary points in any case
        }
    }

    _straightLinesPointerDownH(event, domEventData) {

    }

    _erasePointerDownH(event, domEventData){
        console.log('erasePointerDown');
    }

    _freePenPointerMoveH(event, domEventData) {
        console.log('freePenPointerMoveH');
        if (this._allowedPointer(domEventData) && this.pointerDown) {
            domEventData.preventDefault();
            let pos = this._canvasPos(domEventData);
            let d2 = norm2(vector(this.lastPos, pos));
            // At the beginning of a segment short distances must be allowed, 
            // otherwise no "nearly points such as the one on i" could be drawn
            if (d2 > this.minDist2 || this.segmentArray[this.currSegment].pts.length < 4) {
                this._newPoint(pos);
                this._drawLineSegment(this.lastPos, pos);
                this.lastPos = pos;
            }
        }
    }

    _straightLinesPointerMoveH(event, domEventData) {
    }

    _erasePointerMoveH(event, domEventData) {

    }

    _freePenPointerUpH(event, domEventData) {     
        if (this._allowedPointer(domEventData) && this.pointerDown) {
            domEventData.preventDefault();
            const canvasDomElement = this.editor.editing.view.domConverter.mapViewToDom( this._currentCanvasViewElement );
            this.pointerDown = false;
            if (domEventData.pointerType == 'mouse') {
                canvasDomElement.style.cursor = 'default';
            } else {
                canvasDomElement.style.cursor = 'none';
            }
            this.lastPos = this._canvasPos(domEventData);
            this._newSegment(this.lastPos); // Initializes temporary points in any case
        }
    }

    _straightLinesPointerUpH(event, domEventData) {

    }

    _erasePointerUpH(event, domEventData) {

    }

    /**
     * Checks if canvas is active
     * 
     * @param {view element} canvasViewElement 
     * @returns true if canvas has a lime border marking it as activem false else.
     */
    _isInactiveCanvas( canvasViewElement ) {
        return canvasViewElement.hasClass( 'ispcl-inactive' );
    }

    /**
     * If on == true a gainsboro background is set to canvas, if on == false it is removed
     * 
     * @param {view element} canvasViewElement 
     * @param {bool} on 
     */
    _setCanvasInactiveBackground( canvasViewElement, on ) {
        if ( canvasViewElement ) {
            // The canvas must be redrawn after changing the background.
            // A downcast would add this redrawing, but a simple view change does not.
            // Leaving the widget causes via this._closeCanvas a downcast and then everything is ok, but it is too late
            const canvas = this.editor.editing.view.domConverter.mapViewToDom( canvasViewElement );
            this.isPencilEditing.pendingCanvasDomElements.add( canvas );
            this.editor.editing.view.change( writer => {
                console.log( 'iscanvas._setCanvasInactiveBackground change viewElement', canvasViewElement );
                if ( on ) {
                    writer.addClass( 'ispcl-inactive', canvasViewElement );
                } else {
                    writer.removeClass( 'ispcl-inactive', canvasViewElement );
                }
            });
        }
    }
    /**
     * Is called when the pointer went down on the current canvas before it became active
     * Loads drawings stored in the data-part of the canvas and the current drawing ctx parameters
     * Makes canvas active (signalled by a lime border on canvas) and ready for drawing
     * 
     * @param {view element} canvasViewElement 
     */
    _openCanvas( canvasViewElement ) {
        if ( canvasViewElement ) {
            let content = canvasViewElement.getAttribute( 'data-ispcl-content' );
            if ( content !== undefined) {
                const canvas = this.editor.editing.view.domConverter.mapViewToDom( canvasViewElement );
                // console.log('open canvas', this._uid);
                content = content.replace( /!/g, '"')
                this.segmentArray = JSON.parse(content);
                // console.log('segmentArray', this._segmentArray);
                this.ctx = canvas.getContext('2d');
                // this is the initial value, which is dynamically changed by this.changeColor
                this.ctx.strokeStyle = this.color;
                this.ctx.lineWidth = _lineWidthFromStroke( this.stroke );
            }
        }
    }

    /**
     * Is called when we have been working on a specific canvas and terminate drawing.
     * Stores drawing data in the data- part of the canvas and makes it inactive (signalled by the absence of the lime border).
     * Can be called in any case. If it is not called on an active canvas, it has no effect.
     * 
     * @param {view element} canvasViewElement 
     */
    _closeCanvas( canvasViewElement ) {
        if ( canvasViewElement ) { 
            const canvasUid = canvasViewElement.getAttribute( 'data-ispcl-uid' );
            console.log('iscanvas._closeCanvas close canvas with uid', canvasUid );
            // From View to model
            const canvasModelElement = this.editor.editing.mapper.toModelElement( canvasViewElement ); 
            let encoded = JSON.stringify(this.segmentArray);
            encoded = encoded.replace( /"/g, '!' );
            // Reflect DOM changes to model changes
            this.editor.model.change( writer => {
                writer.setAttribute( 'content', encoded, canvasModelElement );
            } );
        }
    }

    /**
     * Returns undefined or the value of the attribute name of src
     * 
     * @param {HTML DOM element} src 
     * @param {string} name 
     * @returns 
     */
    _getDataValue(src, name) {
        const dataValue = src?.attributes.getNamedItem( name);
        return dataValue?.nodeValue;
    }

    /**
     * Checks that an event was generated either by a mouse or a pointer. This is to exclude touch events
     * 
     * @param {*} event 
     * @returns 
     */
    _allowedPointer(event) {
        return event.pointerType == 'mouse' || event.pointerType == 'pen';
    }
    
    /**
     * Returns the position of the event in canvas coordinates as an object with properties 'x' and 'y'
     * 
     * @param {object} event 
     */
    _canvasPos(event) {
        const canvas = this.editor.editing.view.domConverter.mapViewToDom( this._currentCanvasViewElement );
        let rect = canvas.getBoundingClientRect();
        return {
            x: event.pageX - rect.left - window.scrollX,
            y: event.pageY - rect.top - window.scrollY
        }
    }
    
    _newSegment(p) {
        // Pen width is different for pen and marker, it is set in this.setMode
        let segment = {
            width: this.ctx.lineWidth,
            color: this.ctx.strokeStyle, // the color of the stroke
            stepType: this.stepType,
            pts: []
        }
        this.segmentArray.push(segment);
        this.currSegment = this.segmentArray.length - 1;
        this._newPoint(p);
    }
    /**
     * Adds a point 'pos' to pts array in the current segment this.currSegment
     * 
     * @param {object} pos 
     */
    _newPoint(pos) {
        this.segmentArray[this.currSegment].pts.push(pos);
    }
    
    /**
     * Draws a single segment from point p1 to point p2 on canvas.
     * Note that drawing consecutive segments should not be done with this method,
     * because it would treat the segments as isolated, neglecting the joins
     * 
     * @param {object} p1 
     * @param {object} p2 
     */
    _drawLineSegment(p1, p2) {
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();
    }

    renderIsPencil( canvas ) {
        if ( !canvas ) {
            logError( 'canvas is unavailable for rendering IsPencil' );
        }
        const content = this._getDataValue( canvas, 'data-ispcl-content' );
        if ( content !== undefined) {
            // console.log('open canvas', this._uid);
            this.segmentArray = JSON.parse(content);
        }
        for (let segment of this.segmentArray) {
            this._renderSegment( canvas, segment );
        }        
    }

    _renderSegment( canvas, segment ) {
        console.log( 'render segment', segment );
        this.ctx = canvas.getContext('2d');
        this.ctx.strokeStyle = segment.color;
        this.ctx.lineWidth = segment.width;
        if ( segment.pts.length > 1 ) {
            let p = segment.pts[ 0 ];
            this.ctx.beginPath();
            this.ctx.moveTo(p.x, p.y);
            for (let i = 1; i < segment.pts.length; i++) {
                p = segment.pts[ i ];
                this.ctx.moveTo(p.x, p.y);
            }
            this.ctx.stroke();
        }
    }
}

function norm2(v) {
    return v.x * v.x + v.y * v.y;
}

/**
 * Returns the vector from p1 to p2 as an object with properties 'x' and 'y'
 * 
 * @param {point} p1
 * @param {point} p2
 */
function vector(p1, p2) {
    return {
        x: p2.x - p1.x,
        y: p2.y - p1.y
    }
}

/**
 * this.stroke is a string, while the line width is a number, which can be adjusted in this functio
 * 
 * @param {string} stroke 
 * @returns a number for this._ctx.lineWidth
 */
function _lineWidthFromStroke( stroke ) {
    switch (stroke) {
        case 'thin':
            return 2;
        case 'medium':
            return 5;
        case 'thick':
            return 10;
        case 'xthick':
            return 15;
        default:
            return 1;
    }
}