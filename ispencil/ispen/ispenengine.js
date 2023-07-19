// ispenengine.js

export function attachIsPencil( jsonparams ) {
    const options = JSON.parse( jsonparams );
    console.log( 'IsPenEngine options', options);
    const isPenEngine = new IsPenEngine( options );
    console.log('instantiated IsPenEngine', isPenEngine );
    const candidates = document.getElementsByClassName( 'ispcl-canvas' );
    if ( candidates ) {
        for ( let candidate of candidates ) {
            console.log( 'rendering candidate', candidate);
            console.log('type of candidate', typeof candidate);
            isPenEngine.canvas = candidate;
            isPenEngine.render();
        }
    }
}

export class IsPenEngine {

    interpolation = undefined;

    /**
     * Sets the interpolation between points. Possible values are 'line' the default, 'bezier' and 'mixed'
     * @param {string} interpolation 
     */
    set interpolation( value ) {
        if ( ![ 'line', 'bezier' ].includes( value ) ) {
            throw new Error( 'Invalid interpolation ' + value );
        }
        this.interpolation  = interpolation;
    }

    set canvas( value ) {
        this._canvas = value;
    }

    constructor( options ) {
        console.log('IsPenEngine constructor with optione', options);
        if ( options?.interpolation ) {
            this.interpolation = options.interpolation;
        } else {
            this.interpolation = 'bezier';
        }
        // The fraction of secant vector to be used to compute bezier control points
        if ( options?.bezCtrl ) {
            this.bezCtrl = bezCtrl;
        } else {
            this.bezCtrl = 0.3;
        }
    }

    /**
     * Completely remakes the canvas.
     * NOTE You must set a canvas before calling this method
     */
    refresh() {
        if (!this._canvas) {
            throw new Error(' IsPenEngine.refresh called with missing _canvas' );
        }
        // Clear the canvas
        let ctx = this._canvas.getContext('2d');
        ctx.clearRect( 0, 0, this._canvas.width, thi.canvas,height );
        // Remake it from scratch
        this.render();
    }

    /**
     * Performs all the drawing encoded in the attribute 'data-ispcl-content' of an IsPencil canvas
     * NOTE You must set the canvas, using the setter of canvas like isPenEngine.canvas = myWantedCanvas
     */
    render() {
        let content = this._canvas?.getAttribute( 'data-ispcl-content' );
        if ( content ) {
            content = content.replace( /!/g, '"' );
            console.log('decoded json ', content);
            let segmentArray = undefined;
            try {
                segmentArray = JSON.parse( content ); // Throws an exception
            } catch (ex) {
                console.log('Exception', ex);
            }
            console.log('segmentArray', segmentArray);
            for ( let segment of segmentArray ) {
                switch (this.interpolation) {
                    case 'line':
                        this.lineSegment( segment );
                        break;
                    case 'bezier':
                        this.bezierSegment( segment );
                        break;
                    case 'mixed':
                        if ( segment.stepType == 'L' ) {
                            this.lineSegment( segment )
                        } else if ( segment.stepType == 'B' ) {
                            this.bezierSegment( segment );
                        } else {
                            throw new Error( 'Invalid stepType in segment' );
                        }
                        break;                
                }
            }
        } else {
            throw new Error( 'No valid isPencil canvas has been set');
        }
    }

    /**
     * Draws a segment (a closed path) to this._canvas
     * The path is made up of straight line segments joining the points of the segment
     * 
     * @param {object} segment This is an object describing a closed path
     */
    lineSegment( segment ) {
        console.log( 'line segment' );
        let ctx = this._canvas.getContext('2d');
        ctx.strokeStyle = segment.color;
        ctx.lineWidth = segment.width;
        if ( segment.pts.length > 1 ) {
            let p = segment.pts[ 0 ];
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            for (let i = 1; i < segment.pts.length; i++) {
                p = segment.pts[ i ];
                ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
        }
    }

    /**
     * Draws a segment (closed path) to this._canvas
     * The path is made  up of two line segments at the beginning and the end and bezier curves in between
     * 
     * @param {object} segment 
     */
    bezierSegment( segment ) {
        console.log( 'bezier segment' );
        let ctx = this._canvas.getContext('2d');
        ctx.strokeStyle = segment.color;
        ctx.lineWidth = segment.width;
        if ( segment.pts.length > 1 ) {
            let p = segment.pts[ 0 ];
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            // Join the first two points by a line segment
            p = segment.pts[ 1 ];
            ctx.lineTo(p.x, p.y);
            // Join the points from the second to the before last by bezier curves
            let p1, p2, p3, p4, v1, v2, cp1x, cp1y, cp2x, cp2y;
            for (let i = 0; i < segment.pts.length - 3; i++) {
                p1 = segment.pts[ i ];
                p2 = segment.pts[ i + 1 ];
                p3 = segment.pts[ i + 2 ];
                p4 = segment.pts[ i + 3 ]; 
                v1 = { x: p3.x - p1.x, y: p3.y - p1.y };  // Direction of tangent in p2 (secant p1 to p3)     
                v2 = { x: p2.x - p4.x, y: p2.y - p4.y };  // Direction of tangent in p3 (secant p4 to p2) 
                // Compute the control points on the tangents
                cp1x = p2.x + this.bezCtrl * v1.x;
                cp1y = p2.y + this.bezCtrl * v1.y;
                cp2x = p3.x + this.bezCtrl * v2.x;
                cp2y = p3.y + this.bezCtrl * v2.y;
                ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p3.x, p3.y);
            }
            // Join the before last point to the last by a line segment
            p = segment.pts[ segment.pts.length - 1 ]; // last point
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
        }
    }
}