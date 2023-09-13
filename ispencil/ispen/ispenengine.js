// ispenengine.js

/**
 * DATA STRUCTURE
 * 
 * drawing
 * =======
 * An object with properties 'version', 'pathArray'
 * 
 * version
 * =======
 * A string of the form 'x.y' where x and y are integers
 * 
 * pathArray
 * =========
 * An array of 'path'
 * 
 * path
 * ====
 * An object with properties 'width', 'color', 'stepType', 'points'
 * 
 * width
 * ===== 
 * A number, which will be assigned to ctx.width. 
 * 
 * color
 * =====
 * A CSS color which will be assigned to ctx.strokeStyle
 * 
 * stepType
 * ========
 * One of 'L' for line, 'B' for Bezier, 'C' for user choice.
 * The value of stepType is responsible for the chosen interpolation between points of the same path. 
 * In case of 'L' or 'B' interpolation is linear or Bezier.
 * In case 'C' the interpolation type is chosen from the configuration of the engine. Default is linear.
 * 
 * points
 * ======
 * An array of 'points' determining the path.
 * 
 * point
 * =====
 * An array with x at position 0 and y at position 1.
 * 
 * 
 */

/**
 * This function is called from outside CKEditor to draw all IsPencil elements,
 * consisting of a div inside which there is a canvas of class 'ispcl-canvas'.
 * ALL canvases of this class are refreshed from their data attribute 'data-ispcl-content.
 * Configuration is made through jsonparams.
 * 
 * @param {string} jsonparams 
 */
export function attachIsPencil( jsonparams ) {
    const candidates = document.getElementsByClassName( 'ispcl-canvas' );
    // console.log( 'IspenEngine#attachIspencil candidates', candidates );
    const oldCandidates = document.getElementsByClassName( 'ispencil_canvas' ); // This is the convention in the CKEditor4 plugin version = 0.0
    // console.log( 'IspenEngine#attachIspencil oldCandidates', oldCandidates );
    if ( candidates || oldCandidates ) {
        const options = JSON.parse( jsonparams );
        console.log( 'IsPenEngine options', options);
        const isPenEngine = new IsPenEngine( options );
        for ( let candidate of candidates ) {
            // console.log( 'rendering candidate', candidate);
           isPenEngine.redraw( candidate );
        }
        for ( let candidate of oldCandidates ) {
            // console.log( 'rendering candidate', candidate);
           isPenEngine.redraw( candidate ); // redraw works transparently for Version 0.0
        }
    }
}

export function refreshCanvas( canvas, options ) {
    const isPenEngine = new IsPenEngine( options );
    isPenEngine.canvas = canvas;
    isPenEngine.render();
    canvas = isPenEngine.canvas;
}

export class IsPenEngine {

    /**
     * The version of this engine
     */
    version = '1.0';

    /**
     * Set by the constructor to 'L' or 'B', depending on the value of the configuration property 'custmInterpolation'. Default is 'L'. 
     * The value determines the interpolation used in path with stepType == 'C'
     */
    _interpolation = undefined;

    /**
     * Set by constructor to the fraction of a secand used for the Bezie control point. Default is 0.3
     */
    _bezCtrl = undefined;


    constructor( options ) {
        // console.log('IsPenEngine constructor with optione', options);
        // The fraction of secant vector to be used to compute bezier control points
        if ( options?.bezCtrl ) {
            this.bezCtrl = bezCtrl;
        } else {
            this.bezCtrl = 0.3;
        }
        // Minimum square distance between points of a path, after the third one. This makes possible minimal paths.
        if ( options?.minDist2 ) {
            this.minDist2 = this.minDist2;
        } else {
            this.minDist2 = 20;
        }
        // Interpolation to be used in Paths with stepType 'C'. Default is linear 'L'
        if ( options?.customInterpolation ) {
            this.customInterpolation = options.customInterpolation;
        } else {
            this.customInterpolation = 'L';
        }

        /****************************************
         * Properties for locally stored drawing
         ****************************************/

        this._drawing = null;
        this._lastPoint = null; 
        this._ctx = null;
        this._currentPathIndex = null;
    }

    /**
     * Decodes content by replacing double quotes unsuitable in a json string by exclamation marks
     * 
     * @param {string} content 
     * @returns 
     */
    decodeData( content ) {
        return content.replace( /£/g, '"' );
    }

    /**
     * Encodes content by replacing double quotes by exclamation marks
     * 
     * @param {string} content 
     * @returns 
     */
    _encodeData( content ) {
        return content.replace( /"/g, '£' );
    }

    /**
     * 
     * @param {string|number} oldWidth 
     * @param {string} oldVersion 
     * @returns 
     */
    _updateWidth( oldWidth, oldVersion ) {
        if ( oldVersion == '0.0' ) {
            // Version 0.0 uses the string weight with values 'thin', 'medium', 'thick' for the width
            switch ( oldWidth ) {
                case 'thin':
                    return 1;
                case 'medium':
                    return 3;
                case 'thick': 
                    return 5;
                default:
                    return 2;
            }
        }
    }

    /**
     * Updates pathArray from an older version 'oldVersion' to the structure of the current version
     * 
     * @param {object} oldPathArray 
     * @param {string} oldVersion 
     * @returns 
     */
    _updatePathArray( oldPathArray, oldVersion ) {
        let newPathArray = [];
        if ( oldVersion == '0.0') {
            for ( let oldPath of oldPathArray ) {
                let newPath = {};
                newPath.width = this._updateWidth( oldPath.weight, oldVersion );
                newPath.color = oldPath.color;
                newPath.stepType = 'L'; // Old points are too dense for Bezier
                newPath.pts = oldPath.points;
                newPathArray.push( newPath );
            }
        }
        return newPathArray;
    }

    /**
     * Returns an object of type drawing for this engine as encoded in the dom element canvas
     * If it is a valid canvas built by an earlier engine, the data is adapted to be a valid drawing for tis engine
     * 
     * @param {dom element of type canvas} canvas 
     * @returns a 'pathArray'
     */
    getDrawing( canvas ) {
        let version;
        if ( canvas.classList.contains( 'ispencil_canvas' ) ) {
            version = '0.0'; // This is the old CKEditor4 isPencil
        } else {
            version = canvas?.getAttribute( 'data-ispcl-version' ); // As from 1.0 a vdersion is mandatory
        }
        if ( !version ) {
            // The canvas was not an isPencil canvas
            return undefined;
        }
        if ( version == this.version ) {
            // The canvas was structured for this engine
            const data = canvas?.getAttribute( 'data-ispcl-content' );
            const decoded = this.decodeData( data );
            if ( decoded ) {
                const pathArray = JSON.parse( decoded ); // Throws an exception, if decoded is not valid json
                return { version, pathArray };
            }
        } else {
            // The canvas was produced by an earlier engine
            const data = canvas?.getAttribute( 'data-ispencil_paths');
            const decoded = this.decodeData( data );
            if ( decoded ) {
                const oldPathArray = JSON.parse( decoded ); // Throws an exception, if decoded is not valid json
                const pathArray = this._updatePathArray( oldPathArray, version );
                return { version: this._version, pathArray }; // pathArray has been updated to this,_version
            }
        }
        return undefined;
    }

    /**
     * Stores the drawing object in the canvas dom element conforming to version this._version
     * NOTE Do not use this method in CKEditor5. canvas is part of the model and changes must be made in the model
     * 
     * @param {dom element} canvas 
     * @param {object} drawing 
     */
    setDrawing( canvas, drawing ) {
        if ( canvas && drawing ) {
            const content = JSON.stringify( drawing.pathArray );
            if ( content ) {
                canvas.setAttribute( 'data-ispcl-version', this._version );
                canvas.setAttribute( 'data-ispcl-content', this._encodeData( drawing.pathArray ) );
            }
        }
    }

    /**
     * Redraws the canvas, by first clearing it and then redrawing it from the stored data.
     * Works for all versions, since older versions are adapted at an early stage by this.getDrawing
     * Loads its own drawing, so it is not bound to the drawing loaded locally by this.loadDrawing.
     * Can be used to redraw canvas in the map of pending canvas in IsPencilEditing.
     * NOTE this.refresh has the same effect, but takes the drawing from this._drawing
     * 
     * @param {dom element} canvas 
     */
    redraw( canvas ) {
        const drawing = this.getDrawing( canvas );
        this._render( canvas, drawing.pathArray );
    }

    /**
     * Clears the canvas and draws all paths in pathArray
     * 
     * @param {dom element} canvas 
     * @param {object pathArray} pathArray 
     */
    _render( canvas, pathArray ) {
        // Clear the canvas
        // console.log( 'IsPenEngine#_render pathArray', pathArray );
        let ctx = canvas.getContext('2d');
        ctx.clearRect( 0, 0, canvas.width, canvas.height );
        if (canvas && pathArray ) {
            for ( let path of pathArray ) {
                this._drawPath( canvas, path );
            }
        }
    }

    /**
     * 
     * @param {dom element of type canvas} canvas 
     * @param {path object} path 
     */
    _drawPath( canvas, path ) {
        console.log( 'ispenengine._drawPath path', path );
        let ctx = canvas.getContext( '2d' );
        ctx.lineWidth = path.width;
        ctx.strokeStyle = path.color;
        let stepType = path.stepType;
        if ( stepType == 'C' ) {
            stepType = this.customInterpolation;
        }
        if (stepType == 'L' ) {
            this._drawLinePath( ctx, path );
        } else if ( stepType == 'B' ) {
            this._drawBezierPath( ctx, path );
        } else {
            throw new Error(' IsPenEngine._drawPath unimplemented interpolation ' + stepType );
        }
    }

    _drawLinePath( ctx, path ) {
        if ( path.pts.length > 1 ) {
            let p = path.pts[ 0 ];
            ctx.beginPath();
            ctx.moveTo( p[ 0 ], p[ 1 ] );
            for (let i = 1; i < path.pts.length; i++) {
                p = path.pts[ i ];
                ctx.lineTo( p[ 0 ], p[ 1 ]);
            }
            ctx.stroke();
        }
    }

    _drawBezierPath( ctx, path ) {
        // console.log( 'bezier segment' );
        if ( path.pts.length > 1 ) {
            const pts = path.pts;
            let p = pts[ 0 ];
            ctx.beginPath();
            ctx.moveTo( p[ 0 ], p[ 1 ] );
            // Join the first two points by a line segment
            p = pts[ 1 ];
            ctx.lineTo( p[ 0 ], p[ 1 ] );
            // Join the points from the second to the before last by bezier curves
            let p1, p2, p3, p4, v1, v2, cp1x, cp1y, cp2x, cp2y;
            for (let i = 0; i < pts.length - 3; i++) {
                p1 = pts[ i ];
                p2 = pts[ i + 1 ];
                p3 = pts[ i + 2 ];
                p4 = pts[ i + 3 ]; 
                v1 = { x: p3[ 0 ] - p1[ 0 ], y: p3[ 1 ] - p1[ 1 ] };  // Direction of tangent in p2 (secant p1 to p3)     
                v2 = { x: p2[ 0 ]- p4[ 0 ], y: p2[ 1 ] - p4[ 1 ] };  // Direction of tangent in p3 (secant p4 to p2) 
                // Compute the control points on the tangents
                cp1x = p2.x + this.bezCtrl * v1.x;
                cp1y = p2.y + this.bezCtrl * v1.y;
                cp2x = p3.x + this.bezCtrl * v2.x;
                cp2y = p3.y + this.bezCtrl * v2.y;
                ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p3.x, p3.y);
            }
            // Join the before last point to the last by a line segment
            p = pts[ pts.length - 1 ]; // last point
            ctx.lineTo( p[ 0 ], p[ 1 ] );
            ctx.stroke();
        }
    }

    /*************************************************************
     * Live handling of this._drawing with locally stored drawing
     *************************************************************/

    /**
     * Loads the drawing to a local object this._drawing 
     * 
     * @param {dom element} canvas 
     */
    loadFromCanvas( canvas ) {
        this._drawing = this.getDrawing( canvas );
    }

    /**
     * Returns the encoded json of the local pathArray
     * NOTE In CKEditor4 canvas is part of the model. The content attribute must be set on the model, not on the dom level.
     * 
     * @returns {string}
     */
    getEncodedContent() {
        const content = JSON.stringify( this._drawing.pathArray );
        return this._encodeData( content );
    }

    _addPoint( point ) {
        this._drawing.pathArray[ this._currentPathIndex ].pts.push( point );
        this._lastPoint = point;
    }

    _segment( p1, p2 ) {
        // console.log( 'IsPenEngine#_segment p1', p1 );
        // console.log( 'IsPenEngine#_segment p2', p2 );
        // console.log( 'IsPenEngine#_segment ctx', this._ctx );
        this._ctx.beginPath();
        this._ctx.moveTo( p1[ 0 ], p1[ 1 ] );
        this._ctx.lineTo( p2[ 0 ], p2[ 1 ] );
        this._ctx.stroke();
    }

    startPath( canvas, startPoint, width, color, stepType ) {
        if ( canvas ) {
            const path = {
                width,
                color,
                stepType,
                pts: []
            }
            this._drawing.pathArray.push(path);
            this._currentPathIndex = this._drawing.pathArray.length - 1;
            this._addPoint( startPoint );
            this._ctx = canvas.getContext( '2d' );
            this._ctx.strokeStyle = color;
            this._ctx.lineWidth = width;
        }
    }

    moveTo( point ) {
        // console.log( 'IsPenEngine#moveTo point', point );
        // console.log( 'IsPenEngine#moveTo lastPoint', this._lastPoint );
        if ( this._drawing.pathArray[ this._currentPathIndex ].pts.length < 4 ) {
            this._segment( this._lastPoint, point );
            this._addPoint( point );
        } else {
            const dist2 = norm2( vector( this._lastPoint, point) ); // Square of distance to the last point
            if ( dist2 > this.minDist2 ) {
                this._segment( this._lastPoint, point );
                this._addPoint( point );
            }
        }
    }

    terminatePath( lastPoint ) {
        this._segment( this._lastPoint, lastPoint ); // from last set point to last path point
        this._addPoint( lastPoint );
        this._lastPoint = null; 
        this._ctx = null;
        this._currentPathIndex = null;
    }

    erase( canvas, rect ) {
        console.log( 'IspenEngine#erase rect', rect );
        let remove = []; // array of indices of paths, that should be removed
        for (let i = 0; i < this._drawing.pathArray.length; i++) {
            const path = this._drawing.pathArray[ i ];
            if ( path?.pts.length > 0 ) {
                const startPoint = path.pts[ 0 ];
                const endPoint = path.pts[ path.pts.length - 1 ];
                if ( inRect( rect, startPoint) || inRect( rect, endPoint ) ) {
                    // erase this entry
                    remove.push( i );
                }
            }
        }
        if ( remove.length > 0 ) {
            this._drawing.pathArray = this._drawing.pathArray.filter( (value, index, arr) => { return !remove.includes( index ) } )
            this.refresh( canvas );
        }
    }

    /**
     * Clears and redraws the canvas
     * NOTE while this.redraw takes the drawing from the ispcl-content attribute of canvas, refresh takes it from the locally stored drawin
     * 
     * @param {dom element} canvas 
     */
    refresh( canvas ) {
        this._render( canvas, this._drawing.pathArray );
    }

}

function inRect( rect, point ) {
    return point[ 0 ] >= rect.left && point[ 1 ] >= rect.top && point[ 0 ] <= rect.right && point[ 1 ] <= rect.bottom;
}

/** 
 * @param {vector} v 
 * @returns square norm of v
 */
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
        x: p2[ 0 ] - p1[ 0 ],
        y: p2[ 1 ] - p1[ 1 ]
    }
}