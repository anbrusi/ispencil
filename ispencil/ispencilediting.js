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
import { refreshCanvas } from './ispen/ispenengine';
import IsPencilInsertCommand from './ispencilinsertcommand';

export default class IsPencilEditing extends Plugin {

	static get pluginName() {
		return 'IsPencilEditing';
	}

    static get requires() {
        return [ Widget ];
    }

    init() {
        // console.log('IsPencilEditing#init');
        this._defineSchema();
        this._defineConverters();
        this.pendingCanvases = new Set();
        this.editor.editing.view.on( 'render', () => { 
            for ( let canvas of this.pendingCanvases ) {
                refreshCanvas( canvas );
                // console.log( 'refreshed canvas', canvas );
                this.pendingCanvases.delete( canvas );
            }
            // console.log( 'pending canvases after refresh', this.pendingCanvases );
        } );
        this.editor.commands.add( 'isPencilInsertCommand', new IsPencilInsertCommand( this.editor ) );
        // this.editor.commands.add( 'isPencilPosCommand', new IsPencilPosCommand( this.editor ) );
        // this.editor.commands.add( 'isPencilSizeCommand', new IsPencilSizeCommand( this.editor ) );
    }

    _defineSchema() {
        const schema = this.editor.model.schema;

        schema.register( 'isPencil', {
            // Behaves like a self-contained object (e.g. an image).
            isObject: true,

            // Allow in places where other blocks are allowed (e.g. directly in the root).
            allowWhere: '$block',

            // Allow these attributes in isPencil model nodes
            allowAttributes: [ 'hasBorder' ]
        } );

        schema.register( 'isPencilCanvas', {
            isObject: true,            
            allowIn: 'isPencil',
            // These are the model attribute names, which may differ from view attributte names
            allowAttributes: [ 'width', 'height', 'content', 'uid' ]
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
                    // position: modelPosition( viewElement ) // Decodes CSS of viewElement into one of 'left', 'center', 'right' or possibly null
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
                attributes: [ 'width', 'height', 'data-ispcl-uid', 'data-ispcl-content' ], // These view attributes are mandatory
            },
            model: ( viewElement, { writer} ) => {
                const attributes = {
                    width: viewElement.getAttribute( 'width' ),
                    height: viewElement.getAttribute( 'height' ),
                    uid: viewElement.getAttribute( 'data-ispcl-uid' ),
                    content: viewElement.getAttribute( 'data-ispcl-content' )
                }
                const modelElement = writer.createElement( 'isPencilCanvas', attributes );
                // console.log( 'Upcast canvas', modelElement );
                return modelElement;
            }
        } );

        conversion.for( 'dataDowncast' ).elementToElement( {
            model: {
                name: 'isPencil',
                attributes: [ 'hasBorder' ]
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
                attributes: [ 'width', 'height', 'uid', 'content' ]
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
                attributes: [ 'hasBorder' ]
            },
            view: (modelElement, { writer: viewWriter } ) => {
                // class is a string with all classes to be used in addition to automatic CKEditor classes
                const widgetView = viewWriter.createContainerElement( 'div', makeIsPencilViewAttributes(  modelElement ) );
                return toWidget( widgetView, viewWriter, { hasSelectionHandle: true } );
                // return widgetView;
            }
        } );

        conversion.for( 'editingDowncast' ).elementToElement( {
            model: {
                name: 'isPencilCanvas',
                attributes: [ 'width', 'height', 'uid', 'content' ]
            },
            view: (modelElement, { writer: viewWriter } ) => {
                // class is a string with all classes to be used in addition to automatic CKEditor classes
                const canvasView = viewWriter.createRawElement( 'canvas', makeIsPencilCanvasViewAttributes(  modelElement ) );
                canvasView.render = ( domElement, domConverter) => {
                    // console.log('rendering dom element', domElement);
                    this.pendingCanvases.add( domElement );
                };
                return canvasView;
            }
        } );
    }
}

/**
 * Returns a definition of view attributes from model attributes for the model Elemet isPencil
 * 
 * @param {object} modelElement 
 * @returns 
 */
function makeIsPencilViewAttributes( modelElement ) {
    // Add a border to the container div, only if required. In absence of this class there is no border 
    let classes = 'ispcl-fitcontent';
    const hasBorder = modelElement.getAttribute( 'hasBorder' );
    if ( hasBorder && hasBorder == true ) {                  
        classes += ' ispcl-thinborder';
    };
    let attributes = {
        class: classes // attributes.class is a space separated list of CSS classes
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
    return attributes;
}