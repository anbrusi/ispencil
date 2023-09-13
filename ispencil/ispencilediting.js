//ispencil/ispencilediting.js

/**
 * Besides handling conversion, this plugin is responsible for rendering the canvases of isPencil widgets.
 * The property pendingCanvases is a set of canvas DOM elements that must be rendered, after havin been downcasted for editing.
 * 
 * The rendering itself can take place only after completion of the downacast. An attempt to render a canvas in
 * the conversion for editingDowncast just before returning the canvasView failed (the corresponding DOM element is not ready).
 * The chosen solution is to make the canvas a raw element. Such elements call a render function in DomConverter#viewToDom,
 * which gets the domElement as a parameter. Rendering in this function is still too early. It worked if the
 * rendering was delayed (even 1 ms was sufficient) with setTimeout, but this would have been only a last resort.
 * 
 * The render function of the raw element canvasView is set to register the canvas passed as domElement parameter
 * in the set pendingCanvases, thus marking a canvas as to be rendered, but not yet rendering it. The actual rendering
 * is made in a callback of the 'render' event of the global view in this.editor.editing.view. This event happens
 * after the rendering by CKEditor itself has taken place.
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import { Widget, toWidget } from '@ckeditor/ckeditor5-widget';
import IsPencilInsertCommand from './ispencilinsertcommand';
import IsPencilPosCommand from './ispencilposcommand';
import IsCanvas from './ispen/iscanvas';
import IsResizing from './resize/isresizing';

export default class IsPencilEditing extends Plugin {

	static get pluginName() {
		return 'IsPencilEditing';
	}

    static get requires() {
        return [ Widget, IsResizing ];
    }

    init() {
        // console.log('IsPencilEditing#init');
        this._defineSchema();
        this._defineConverters();
        this.pendingCanvasDomElements = new Set();
        this.editor.editing.view.on( 'render', () => { 
            for ( let canvasDomElement of this.pendingCanvasDomElements ) {
                this.isCanvas.isPenEngine.redraw( canvasDomElement );
                this.pendingCanvasDomElements.delete( canvasDomElement );
            };
        } );
        this.editor.commands.add( 'isPencilInsertCommand', new IsPencilInsertCommand( this.editor ) );
        this.editor.commands.add( 'isPencilPosCommand', new IsPencilPosCommand( this.editor ) );

        this.isResizing = this.editor.plugins.get( IsResizing );
        this.isCanvas = this.editor.plugins.get( IsCanvas );
    }

    _defineSchema() {
        const schema = this.editor.model.schema;

        schema.register( 'isPencil', {
            // Behaves like a self-contained object (e.g. an image).
            isObject: true,

            // Allow in places where other blocks are allowed (e.g. directly in the root).
            allowWhere: '$block',

            // Allow these attributes in isPencil model nodes
            allowAttributes: [ 'hasBorder', 'position' ]
        } );

        schema.register( 'isPencilCanvas', {
            isObject: true,            
            allowIn: 'isPencil',
            // These are the model attribute names, which may differ from view attributte names
            allowAttributes: [ 'width', 'height', 'content', 'uid', 'version' ]
        } );
    }

    _defineConverters() {
        const conversion = this.editor.conversion;

        conversion.for( 'upcast' ).elementToElement( {
            // view is a pattern matching all view elements which should be converted. 
            // If not set, the converter will fire for every view element.
            view: {
                name: 'div',
                classes: [ 'ispcl-fitcontent' ]
            },
            model: ( viewElement, { writer} ) => {
                const attributes = {
                    hasBorder: viewElement.hasClass( 'ispcl-thinborder' ),
                    position: modelPosition( viewElement ) // Decodes CSS of viewElement into one of 'left', 'center', 'right' or possibly null
                }
                const modelElement = writer.createElement( 'isPencil', attributes );
                // console.log( 'Upcast div', modelElement );
                return modelElement;
            }
        } );

        conversion.for( 'upcast' ).elementToElement( {
            // view is a pattern matching all view elements which should be converted. 
            // If not set, the converter will fire for every view element.
            view: {
                name: 'canvas',
                classes: 'ispcl-canvas', // This is a fake class, with no definition in CSS
                attributes: [ 'width', 'height', 'data-ispcl-uid', 'data-ispcl-content', 'data-ispcl-version' ], // These view attributes are mandatory
            },
            model: ( viewElement, { writer} ) => {
                const attributes = {
                    width: viewElement.getAttribute( 'width' ),
                    height: viewElement.getAttribute( 'height' ),
                    uid: viewElement.getAttribute( 'data-ispcl-uid' ),
                    content: viewElement.getAttribute( 'data-ispcl-content' ),
                    version: viewElement.getAttribute( 'data-ispcl-version' )
                }
                const modelElement = writer.createElement( 'isPencilCanvas', attributes );
                // console.log( 'Upcast canvas', modelElement );
                return modelElement;
            }
        } );

        conversion.for( 'dataDowncast' ).elementToElement( {
            model: {
                name: 'isPencil',
                attributes: [ 'hasBorder', 'position' ]
            },
            view: (modelElement, { writer: viewWriter } ) => {
                // class is a string with all classes to be used in addition to automatic CKEditor classes
                const isPencil = viewWriter.createContainerElement( 'div', makeIsPencilViewAttributes(  modelElement ) );
                // console.log( 'downcast data isPencil', isPencil );
                return isPencil;
            }
        } );

        conversion.for( 'dataDowncast' ).elementToElement( {
            model: {
                name: 'isPencilCanvas',
                attributes: [ 'width', 'height', 'uid', 'content', 'version' ]
            },
            view: (modelElement, { writer: viewWriter } ) => {
                // class is a string with all classes to be used in addition to automatic CKEditor classes
                const isPencilCanvas = viewWriter.createRawElement( 'canvas', makeIsPencilCanvasViewAttributes(  modelElement ) );
                // console.log( 'downcast data isPencilCanvas', isPencilCanvas );
                return isPencilCanvas;
            }
        } );

        conversion.for( 'editingDowncast' ).elementToElement( {
            model: {
                name: 'isPencil',
                attributes: [ 'hasBorder', 'position' ]
            },
            view: (modelElement, { writer: viewWriter } ) => {
                const widgetBasicViewElement = viewWriter.createContainerElement( 'div', makeIsPencilViewAttributes(  modelElement ) );
                const widgetViewElement = toWidget( widgetBasicViewElement, viewWriter, { hasSelectionHandle: true } );
                const resizerViewElement = this.isResizing.createResizer( viewWriter, modelElement.getAttribute( 'position' ) );
                viewWriter.insert(viewWriter.createPositionAt(widgetViewElement, 'end' ), resizerViewElement);
                return widgetViewElement;
            }
        } );

        conversion.for( 'editingDowncast' ).elementToElement( {
            model: {
                name: 'isPencilCanvas',
                attributes: [ 'width', 'height', 'uid', 'content', 'version' ]
            },
            view: (modelElement, { writer: viewWriter } ) => {
                // class is a string with all classes to be used in addition to automatic CKEditor classes
                const attributes =  makeIsPencilCanvasViewAttributes(  modelElement );
                const canvasView = viewWriter.createRawElement( 'canvas', attributes );
                canvasView.render = ( domElement, domConverter) => {
                    // console.log('rendering dom element', domElement);
                    this.pendingCanvasDomElements.add( domElement );
                };
                return canvasView;
            }
        } );
    }
}

/**
 * Returns one of the model position attributes [ 'left', 'center', 'right' ] from the corresponding CSS class in the view
 * 
 * @param {@ckeditor/ckeditor5-engine/src/view/element} viewElement 
 * @returns 
 */
function modelPosition( viewElement ) {
    if ( viewElement.hasClass( 'ispcl-leftpos' ) ) {
        return 'left';
    }
    if ( viewElement.hasClass( 'ispcl-centerpos' ) ) {
        return 'center';
    }
    if ( viewElement.hasClass( 'ispcl-rightpos' ) ) {
        return 'right';
    }
    return null;
}


/**
 * Returns the name of the CSS class implementing the model position attributes 'left', 'center', 'right'
 * @param {string} modelPositionAttribute 
 * @returns 
 */
function getPositionClass( modelPositionAttribute ) {
    switch ( modelPositionAttribute ) {
        case 'left':
            return 'ispcl-leftpos';
        case 'center':
            return 'ispcl-centerpos';
        case 'right':
            return 'ispcl-rightpos';
        default:
            return '';
    }
}

/**
 * Returns a definition of view attributes from model attributes for the model Elemet isPencil
 * 
 * @param {object} modelElement 
 * @returns 
 */
function makeIsPencilViewAttributes( modelElement ) {
    // This is a strange quirk. Height and width of canvas are attributes, not CSS styles.
    // If a canvas with height 200 is in a div, that div will have a content with CSS Height 204px.
    // width: fit-acontent on the other hand adapts correctly to the attribute width of the canvas.
    // This behaviour was verified with a pure HTML file, it is not peculiar to CKEditor
    // The best solution I found, was to set a CSS height style to the div equal to the attribute height of the canvas
    const height = modelElement.getChild(0).getAttribute( 'height' );
    // Add a border to the container div, only if required. In absence of this class there is no border 
    let classes = 'ispcl-fitcontent';
    // Add the positioning class. It is present in any case
    classes += ' ' + getPositionClass( modelElement.getAttribute( 'position' ) );
    const hasBorder = modelElement.getAttribute( 'hasBorder' );
    if ( hasBorder && hasBorder == true ) {                  
        classes += ' ispcl-thinborder';
    };
    let attributes = {
        class: classes, // attributes.class is a space separated list of CSS classes
        style: `height: ${height}px;` // redundant height setting to compensate for the quirk allocating extra 4px to the div
    }
    return attributes;
}

/**
 * Returns a definition of view attributes from model attributes for the model Elemet isPencilCanvas
 * 
 * @param {object} modelElement 
 * @returns 
 */
function makeIsPencilCanvasViewAttributes( modelElement ) {
    let attributes = { 
        // This class will be in the view but not in the model.     
        class: 'ispcl-canvas', // fake class needed for pattern identification. Could be used to color the canvas  
        width: modelElement.getAttribute( 'width' ),
        height: modelElement.getAttribute( 'height' )
    };
    // Due to the needed minus in the attribute names, dot access does not work and square bracket notation is needed.
    attributes[ 'data-ispcl-uid' ] = modelElement.getAttribute( 'uid' );
    attributes[ 'data-ispcl-content' ] = modelElement.getAttribute( 'content' );
    attributes[ 'data-ispcl-version' ] = modelElement.getAttribute( 'version' );
    return attributes;
}