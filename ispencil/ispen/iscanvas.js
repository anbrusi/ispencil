// ispen/iscanvas.js

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import { DomEmitterMixin, global } from '@ckeditor/ckeditor5-utils';
import { logError } from '@ckeditor/ckeditor5-utils/src/ckeditorerror';

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
        // Plugins are Observable, but this.ListenTo would not do, since we need a DomEmitterMixin, not just a an eEmitterMixin
        // DOM emitter mixin is by default available in the View class, but it can also be mixed into any other class:
        this._observer = new (DomEmitterMixin())();
        this._observer.listenTo( domDocument, 'pointerdown', this._pointerdownListener.bind( this ) );
        this._observer.listenTo( domDocument, 'pointermove', this._pointermoveListener.bind( this ) );
        this._observer.listenTo( domDocument, 'pointerup', this._pointerupListener.bind( this ) );

        // If this is not null, there is a current canvas we are working on.
        // The value of this._canvas is set at each pointerdown and pointerup by 
        // this._pointerdownListener and this._pointerupListener
        this._canvas = null;
        // Th uid of the current canvas, if it has not been closed, else null
        this._uid = null;

        // These are the handlers for the default mode 
        this._pointerDownH = this._freePenPointerDownH;
        this._pointerMoveH = this._freePenPointerMoveH;
        this._pointerUpH = this._freePenPointerUpH;

        /**
         * this._canvas is set by this._pointerDownH and is the last canvas on which the pointer went down or null
         * this._uid is the uid of this._canvas
         */
         
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

    changeColor( newColor ) {
        this.color = newColor;
        if (this._canvas) {
            this.ctx.strokeStyle = this.color;
        }
    }

    changeStroke( newStroke ) {
        this.stroke = newStroke;
        if (this._canvas) {
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
        if (srcElement.classList.contains( 'ispcl-canvas' )) {
            console.log('pointerDown on canvas', srcElement);
            // Set the selection on this widget in any case
            const canvasViewElement = this.editor.editing.view.domConverter.mapDomToView( srcElement );
            const widgetViewElement = canvasViewElement.parent;
            if ( widgetViewElement ) {
                const widgetModelElement = this.editor.editing.mapper.toModelElement( widgetViewElement );
                console.log( 'turning on widgetModelElement', widgetModelElement );
                this.editor.model.change( writer => writer.setSelection( widgetModelElement, 'on' ) );
            }
        }
        // Consider only pointer or mouse events
        if ( this._allowedPointer(domEventData) ) {
            const srcElement = domEventData.srcElement;
            if (srcElement.classList.contains( 'ispcl-canvas' )) {
                // The pointer went down on a canvas, set the last used canvas
                this._canvas = srcElement;
                // Check which canvas it is
                const newUid = this._getDataValue('data-uid');
                console.log('previous uid', this._uid);
                console.log('newUid', newUid );
                if (newUid) {
                    if (newUid == this._uid) {
                        // We work on the same canvas on which we worked before.
                    } else {
                        // We work on the first canvas or another canvas as we were working on before
                        // Change the current uid, close the old canvas and open the new one
                        if ( this._uid !== null ) {
                            // Ther was a canvas we were working on different from the clicked canvas
                            // ERROR should not happen, because the previous canvas should have been closed by a pointerup
                            this._closeCanvas();
                            console.log( 'Closing an old active canvas, before opening the clicked one' );
                        }
                        this._uid = newUid;
                        this._openCanvas();
                    } 
                    // Be careful to call this only on a canvas, because it prevents defaults
                    this._pointerDownH(event, domEventData);
                } else {
                    // ERROR! hould never happen
                    // The canvas cannot be determined
                    console.log( 'Cannot determine the uid of the clicked canvas' );
                    // This should never happen, because we get here only if the pointer went down on an ispencil canvas
                    // Close any previous canvas
                    this._closeCanvas();
                    this._canvas = null;
                    this._uid = null;
                }
            } else {
                // The pointer went down outside of any canvas
                // Close a possibly open canvas
                if (this._canvas) {
                    this._closeCanvas();
                    this._canvas = null;
                    this._uid = null;
                }
            }
        }
    }

    _pointermoveListener(event, domEventData) {
        const srcElement = domEventData.srcElement;
        if (srcElement.classList.contains( 'ispcl-canvas' )) {
            // console.log('pointerMove on canvas', srcElement); 
            if (this._allowedPointer(domEventData) && !!this._canvas) {
                this._pointerMoveH(event, domEventData);
            }
        }  
    }    

    _pointerupListener(event, domEventData) {
        const srcElement = domEventData.srcElement;
        if ( srcElement.classList.contains( 'ispcl-canvas' ) ) {
            // Pointer up in a canvas
            const uid = this._getDataValue('data-uid');
            if (uid == this._uid) {
                // Pointer went up in the canvas we were working on
            } else {
                // Pointer went up in another canvas as the one we were working on
                // This can happen if we have adiacent canvases and we move from one to the other without releasing the pointer
                this._closeCanvas();
                this._canvas = null;
                this._uid = null;
            }
        } else {
            // Pointer up outside of any canvas
            if ( this._canvas ) {
                this._closeCanvas();
                this._canvas = null;
                this._uid = null;
            }
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
            this.pointerDown = true;
            if (domEventData.pointerType == 'mouse') {
                this._canvas.style.cursor = 'crosshair';
            } else {
                this._canvas.style.cursor = 'none';
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
        // console.log('freePenPointerMoveH');
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
        this.pointerDown = false;
    }

    _straightLinesPointerUpH(event, domEventData) {

    }

    _erasePointerUpH(event, domEventData) {

    }

    /**
     * Is called when the pointer went down on a canvas we were not working on.
     * Loads drawings stored in the data-part of the canvas
     */
    _openCanvas() {
        let content = this._getDataValue( 'data-ispcl-content' );
        if ( content !== undefined) {
            // console.log('open canvas', this._uid);
            content = content.replace( /!/g, '"')
            this.segmentArray = JSON.parse(content);
            // console.log('segmentArray', this._segmentArray);
            this.ctx = this._canvas.getContext('2d');
            // this is the initial value, which is dynamically changed by this.changeColor
            this.ctx.strokeStyle = this.color;
            this.ctx.lineWidth = _lineWidthFromStroke( this.stroke );
        }
    }

    /**
     * Is called when we have been working on a specific canvas and the pointer went up outside any canvas 
     * or if the pointer went down om another canvas as the one we were working on.
     * Stores drawing data in the data- part of the canvas.
     * Is called by pointerup before setting this._canvas and this._uid to null
     */
    _closeCanvas() {
        if ( !!this._canvas ) { 
            console.log('close canvas with uid', this._uid);
            // From DOM to View
            const canvasViewElement = this.editor.editing.view.domConverter.mapDomToView( this._canvas );
            // From View to model
            const canvasModelElement = this.editor.editing.mapper.toModelElement( canvasViewElement ); 
            let encoded = JSON.stringify(this.segmentArray);
            encoded = encoded.replace( /"/g, '!' );
            // Reflect DOM changes to model changes
            this.editor.model.change( writer => {
                writer.setAttribute( 'content', encoded, canvasModelElement );
            } );
        } else {
            // ERROR is called only when this._canvas should be defined
            logError( 'Close Canvas called on undefined canvas', this._canvas );
        }
    }

    /**
     * Returns a data-xxx value of the current canvas or undefined
     * 
     * @param {string} name the full name of the data-xxx attribute
     * @returns 
     */
    _getDataValue(name) {
        const dataValue = this._canvas?.attributes.getNamedItem( name);
        return dataValue?.nodeValue;
    }

    /**
     * Overwrites a data-xxx attribute of this._canvas and returns the old attribute
     * 
     * @param {string} name 
     * @param {*} value 
     * @returns 
     */
    _setDataValue(name, value) {
        const dataValue = this._canvas?.attributes.getNamedItem( name);
        dataValue.nodeValue = value;
        return this._canvas?.attributes.setNamedItem(dataValue);
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
        let rect = this._canvas.getBoundingClientRect();
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
        this._canvas = canvas;
        const content = this._getDataValue( 'data-ispcl-content' );
        if ( content !== undefined) {
            // console.log('open canvas', this._uid);
            this.segmentArray = JSON.parse(content);
        }
        for (let segment of this.segmentArray) {
            this._renderSegment( segment );
        }        
    }

    _renderSegment( segment ) {
        console.log( 'render segment', segment );
        this.ctx = this._canvas.getContext('2d');
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