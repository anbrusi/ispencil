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
        // Plugins are Observable, but this.ListenTo would not do, since we need a DomEmitterMixin, not just a an eEmitterMixin
        // DOM emitter mixin is by default available in the View class, but it can also be mixed into any other class:
        this._observer = new (DomEmitterMixin())();
        this._observer.listenTo( domDocument, 'pointerdown', this._pointerdownListener.bind( this ) );
        this._observer.listenTo( domDocument, 'pointermove', this._pointermoveListener.bind( this ) );
        this._observer.listenTo( domDocument, 'pointerup', this._pointerupListener.bind( this ) );
        
        this.isPencilEditing = this.editor.plugins.get( IsPencilEditing );

        /*
        this.set( 'activeUid', null);
        this.on( 'change:activeUid', (evt, propertyName, newValue, oldValue) => {
            console.log(
            `${ propertyName } has changed from ${ oldValue } to ${ newValue }`
             );
            console.log( 'activeUid changed to', this.activeUid );
            if ( this._canvas ) {
                const model = this.editor.model;  
                const canvasModelElement = this.domToModel( this._canvas );
                console.log( 'canvas model element', canvasModelElement );
                const viewElement = this.editor.editing.view.domConverter.mapDomToView( this._canvas );
                this.editor.editing.view.change( writer => {
                    if (this.activeUid == this._uid) {
                        writer.addClass( 'ispcl-active', viewElement );
                    } else {
                        writer.removeClass( 'ispcl-active', viewElement );
                    }
                    // The canvas must be redrawn, because otherwise it is blank after the lime boerer class is added
                    this.isPencilEditing.pendingCanvases.add( this._canvas );
                });
            }
        } );
        */

        /**
         * The current canvas if there is one, null else
         * 
         * {DOM element}
         */
        this._canvas = null;

        // The uid of the current canvas or null if there is no current canvas (this is the initial default)
        // Each click on a canvas sets this._uid to the uid of the canvas and makes it current.
        // Each click outside of any canvas sets this._uid to null
        this._uid = null;

        this._activeUid = null;

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
        const previousCanvas = this._canvas;
        if (srcElement.hasAttribute( 'data-ispcl-content' )) {
            // Pointer went down on canvas
            // console.log('pointerDown on canvas', srcElement);
            this._canvas = srcElement;
            const previousUid = this._uid; // Save the old uid to detect changes
            this._uid = this._getDataValue( srcElement, 'data-ispcl-uid') ;
            // Check which canvas it is
            if ( this._uid && this._uid == previousUid ) {
                // Pointerdown on the current canvas
                if ( this._uid == this._activeUid ) {
                    // Ponterdown on current already active canvas. Start a segment
                    if ( this._allowedPointer(domEventData) ) {
                        console.log('start painting on canvas', this._activeUid);
                        this._pointerDownH(event, domEventData);
                    } else {
                        // An active canvas was touched with a finger. Do nothing
                    }
                } else {
                    // Pointerdown on current canvas, which is not active. Make it active and start painting
                    if ( this._allowedPointer(domEventData) ) {
                        this._setActiveUid( this._canvas, this._uid );
                        this._pointerDownH(event, domEventData);
                    } else {
                        // An active canvas was touched with a finger. Do nothing
                    }
                }
            } else {
                // Pointer down on non current canvas
                this._setActiveUid( previousCanvas, null );
            }
        } else {
            // Pointerdown outside of canvas
            this._canvas = null;
            this._uid = null;
            this._setActiveUid( previousCanvas, null );
            // Final operations will take place in pointerUp, which needs this._canvas and this._uid, So do not set it here
        }
    }

    _pointermoveListener(event, domEventData) {
        const srcElement = domEventData.srcElement;
        if (srcElement.hasAttribute( 'data-ispcl-content' )) {
            // console.log('pointerMove on canvas', srcElement); 
            if (this._allowedPointer(domEventData) && !!this._canvas) {
                this._pointerMoveH(event, domEventData);
            }
        }  
    }    

    _pointerupListener(event, domEventData) {
        const srcElement = domEventData.srcElement;
        if (srcElement.hasAttribute( 'data-ispcl-content' )) {
            // Pointer up in a canvas
            const uid = this._getDataValue(srcElement, 'data-ispcl-uid');
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
        if (this._allowedPointer(domEventData) && this.pointerDown) {
            domEventData.preventDefault();
            this.pointerDown = false;
            if (domEventData.pointerType == 'mouse') {
                this._canvas.style.cursor = 'default';
            } else {
                this._canvas.style.cursor = 'none';
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
     * If on == true a border is set to canvas, if on == false, it is removed
     * 
     * @param {HTML DOM element} canvas 
     * @param {bool} on 
     */
    _setCanvasActiveBorder( canvas, on ) {
        if ( canvas ) {
            const canvasUid = this._getDataValue( canvas, 'data-ispcl-uid' );
            console.log( 'iscanvas._setCanvasActiveBorder canvas with id', canvasUid );
            const viewElement = this.editor.editing.view.domConverter.mapDomToView( canvas );
            console.log( 'viewElement of canvas', viewElement );
            this.editor.editing.view.change( writer => {
                console.log( 'iscanvas._setCanvasActiveBorder change viewElement', viewElement );
                if ( on ) {
                    writer.addClass( 'ispcl-active', viewElement );
                } else {
                    writer.removeClass( 'ispcl-active', viewElement );
                }
                // The canvas must be redrawn after changing the border.
                // A downcast would add this redrawing, but a simple view change does not
                // Leaving the widget causes via this._closeCanvas a downcast and then everything is ok, but it is too late
                this.isPencilEditing.pendingCanvases.add( canvas );
            });
        }
    }

    /**
     * Sets the active canvas
     * If uid == null, canvas is the canvas, which looses activity, if it is not null,
     * else canvas is the canvas becoming active.
     * As a side effect uid == null removes the border from the canvas becoming inactive
     * and sets the border to the newly active canvas else
     * 
     * @param {*} canvas 
     * @param {*} uid 
     */
    _setActiveUid(canvas,  uid ) {
        // If a nonactive canvas is clicked and then no canvas. both call _setActiveUid with 'uid' = null
        // The first time canvas is the real previous canvas, whose drawing must be saved with close canvas,
        // but the second time previous canvas has rotated and canvas is the nonactive canvas.
        // If the function could be executed twice it would fill the nonactive canvas with the content of the original previous canvas
        // The test uid != this._activeUid avoids this situation, becuse the second time both are null and not different.
        if ( uid != this._activeUid ) {
            if ( canvas ) {
                const canvasUid = this._getDataValue( canvas, 'data-ispcl-uid' );
                if ( uid == null ) {
                    console.log( 'iscanvas._setActiveUid deactivate canvas with uid', canvasUid );
                    this._setCanvasActiveBorder( canvas, false );
                    this._closeCanvas( canvas );
                } else {
                    console.log( 'iscanvas._setActiveUid activate canvas with uid', canvasUid );
                    this._setCanvasActiveBorder( canvas, true );
                    this._openCanvas( canvas );
                }
            }
            this._activeUid = uid;
        }
    }

    /**
     * Is called when the pointer went down on a canvas we were not working on.
     * Loads drawings stored in the data-part of the canvas
     * 
     * @param {HTML DOM element} canvas 
     */
    _openCanvas( canvas ) {
        let content = this._getDataValue(canvas, 'data-ispcl-content' );
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
     * 
     * @param {HTML DOM element} canvas 
     */
    _closeCanvas( canvas ) {
        if ( canvas ) { 
            const canvasUid = this._getDataValue( canvas, 'data-ispcl-uid' );
            console.log('iscanvas._closeCanvas close canvas with uid', canvasUid );
            // From DOM to View
            const canvasViewElement = this.editor.editing.view.domConverter.mapDomToView( canvas );
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
            logError( 'Close Canvas called on undefined canvas', canvas );
        }
    }

    /**
     * Returns a data-xxx value of the current canvas or undefined
     * 
     * @param {string} name the full name of the data-xxx attribute
     * @returns 
     */
    _getDataValue(src, name) {
        const dataValue = src?.attributes.getNamedItem( name);
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
        const content = this._getDataValue( canvas, 'data-ispcl-content' );
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