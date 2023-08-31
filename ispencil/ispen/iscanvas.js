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
            // Attach listeners only inside the editor, lest isPencils outside could cause problems
            const editorClientArea = collection[ 0 ];
            if ( editorClientArea ) {
                this._observer.listenTo( editorClientArea, 'pointerdown', this._pointerdownListener.bind( this ) );
                this._observer.listenTo( editorClientArea, 'pointermove', this._pointermoveListener.bind( this ) );
                this._observer.listenTo( editorClientArea, 'pointerup', this._pointerupListener.bind( this ) );
            }
            // this.listenTo( this.editor.editing.view.document, 'mousedown', this._pointerdownListener.bind( this ) );
        } );

        this.isPencilEditing = this.editor.plugins.get( IsPencilEditing );

        /**
         * This is the canvas model element after a pointer down on its canvas has been processed
         */
        this._currentCanvasModelElement = null;

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
         * this.segmentArray is loaded by this.openCanvas  and stored by this.closeCanvas
         * 
         * this.currSegment is set by this._newSegment
         * 
         * this.ctx is the 2d drawing context of the current canvas. It is set by this.openCanvas
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
        if (this._currentCanvasModelElement) {
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
        if (this._currentCanvasModelElement) {
            this.ctx.lineWidth = _lineWidthFromStroke( this.stroke );
        }
    }

    /**
     * This listener is not modal. The first click selects the widget, since there is no preventDefault in the subsequent handler chain
     * There is no interference with moving the widget, because the default is prevented in the move chain.
     * Moving remains possible, because clck on the handle and subsequent motion does not pass through canvas native handlers
     * 
     * @param {*} event 
     * @param {native dom event} domEventData 
     */
    _pointerdownListener(event, domEventData) {
        console.log( 'pointer down ');
        const srcElement = domEventData.srcElement;
        if (srcElement.hasAttribute( 'data-ispcl-content' )) {
            // domEventData.preventDefault();
            // Pointer down on canvas
            const canvasViewElement = this.editor.editing.view.domConverter.mapDomToView(srcElement);
            const canvasModelElement = this.editor.editing.mapper.toModelElement( canvasViewElement );
            console.log( 'canvasModelElement', canvasModelElement );
            // Check if it is the current canvas
            if ( this._currentCanvasModelElement && 
                canvasModelElement.getAttribute( 'uid') == this._currentCanvasModelElement.getAttribute( 'uid') ) {
                // Pointer down on current canvas
                this._pointerDownH(event, domEventData);
            } else {
                // Pointer down on a canvas, which is not current.
                if ( this._currentCanvasModelElement ) {
                    // There was a previously open canvas
                    this.closeCanvas( this._currentCanvasModelElement );
                }
                this.openCanvas( canvasModelElement );
                this._currentCanvasModelElement = canvasModelElement;
                this._pointerDownH(event, domEventData);
            }
        } else {
            // pointer down outside of canvas
            if ( this._currentCanvasModelElement ) {
                // There was a previously open canvas
                this.closeCanvas( this._currentCanvasModelElement );
                this._currentCanvasModelElement = null;
            }
        }

    }

    _pointermoveListener(event, domEventData) {
        const srcElement = domEventData.srcElement;
        if (srcElement.hasAttribute( 'data-ispcl-content' )) {
            // console.log('pointerMove on canvas', srcElement); 
            if ( this._allowedPointer(domEventData) && this._currentCanvasModelElement ) {
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
            // preventDefault cannot be called, when using the second non modal _pointerdownListener. 
            // Otherwise the widget would never be selected
            // domEventData.preventDefault();
            const currentCanvasViewElement = this.editor.editing.mapper.toViewElement( this._currentCanvasModelElement );
            const canvasDomElement = this.editor.editing.view.domConverter.mapViewToDom( currentCanvasViewElement );
            this.pointerDown = true;
            if (domEventData.pointerType == 'mouse') {
                canvasDomElement.style.cursor = 'crosshair';
            } else {
                canvasDomElement.style.cursor = 'none';
            }
            this.lastPos = this._canvasPos(canvasDomElement, domEventData);
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
            const currentCanvasViewElement = this.editor.editing.mapper.toViewElement( this._currentCanvasModelElement );
            const canvas = this.editor.editing.view.domConverter.mapViewToDom( currentCanvasViewElement );
            domEventData.preventDefault();
            let pos = this._canvasPos(canvas, domEventData);
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
            const canvasViewElement = this.editor.editing.mapper.toViewElement( this._currentCanvasModelElement );
            const canvasDomElement = this.editor.editing.view.domConverter.mapViewToDom( canvasViewElement );
            this.pointerDown = false;
            if (domEventData.pointerType == 'mouse') {
                canvasDomElement.style.cursor = 'default';
            } else {
                canvasDomElement.style.cursor = 'none';
            }
            this.lastPos = this._canvasPos(canvasDomElement, domEventData);
            this._newSegment(this.lastPos); // Initializes temporary points in any case
        }
    }

    _straightLinesPointerUpH(event, domEventData) {

    }

    _erasePointerUpH(event, domEventData) {

    }

    /**
     * Is called when the pointer went down on the current canvas before it became active
     * Loads drawings stored in the data-part of the canvas and the current drawing ctx parameters
     * Makes canvas active (signalled by a lime border on canvas) and ready for drawing
     * 
     * @param {model element} canvasModelElement 
     */
    openCanvas( canvasModelElement ) {
        if ( canvasModelElement ) {
            let content = canvasModelElement.getAttribute( 'content' );
            if ( content !== undefined) {
                const canvasViewElement = this.editor.editing.mapper.toViewElement( canvasModelElement );
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
     * @param {model element} canvasModelElement 
     */
    closeCanvas( canvasModelElement ) {
        if ( canvasModelElement ) { 
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
    _canvasPos(canvas, event) {
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
        console.log( 'drawLineSegment' );
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