//ispencil/ispencilediting.js

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import Widget from '@ckeditor/ckeditor5-widget/src/widget';
import { toWidget } from '@ckeditor/ckeditor5-widget/src/utils';
import IsPencilInsertCommand from './ispencilinsertcommand';
import IsPencilPosCommand from './ispencilposcommand';
import IsPencilSizeCommand from './ispencilsizecommand';

export default class IsPencilEditing extends Plugin {

    static get requires() {
        return [ Widget ];
    }

	static get pluginName() {
		return 'IsPencilEditing';
	}

    init() {
        // console.log('IsPencilEditing#init');
        this._defineSchema();
        this._defineConverters();
        this.editor.commands.add( 'isPencilInsertCommand', new IsPencilInsertCommand( this.editor ) );
        this.editor.commands.add( 'isPencilPosCommand', new IsPencilPosCommand( this.editor ) );
        this.editor.commands.add( 'isPencilSizeCommand', new IsPencilSizeCommand( this.editor ) );
    }

    _defineSchema() {
        const schema = this.editor.model.schema;

        schema.register( 'isPencil', {
            // Behaves like a self-contained object (e.g. an image).
            isObject: true,

            // Allow in places where other blocks are allowed (e.g. directly in the root).
            allowWhere: '$block',

            // Allow these attributes in isPencil model nodes
            // 'position is one of 'left', 'center' 'right'. Default in ckeditor.js is 'center'
            // 'hasBorder is either true or false. Default in ckeditor.js is false
            allowAttributes: [ 'position', 'hasBorder' ]
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
                    position: modelPosition( viewElement ) // Decodes CSS of viewElement into one of 'left', 'center', 'right' or possibly null
                }
                return writer.createElement( 'isPencil', attributes );
            }
        } );

        conversion.for( 'upcast' ).elementToElement( {
            // view is a pattern matching all view elements which should be converted. 
            // If not set, the converter will fire for every view element.
            view: {
                name: 'canvas',
                classes: 'ispcl-canvas', // This is a fake class, with no definition in CSS
                attributes: [ 'width', 'height', 'data-ispcl-content', 'data-uid' ]
            },
            model: ( viewElement, { writer} ) => {
                // console.log( 'upcasting isPencilCanvas', viewElement );
                let viewContentElemen = viewElement.getAttribute( 'data-ispcl-content' );
                console.log( 'upcating content element', viewContentElemen );
                return writer.createElement( 'isPencilCanvas', {
                    width: viewElement.getAttribute( 'width' ),
                    height: viewElement.getAttribute( 'height' ),
                    content: viewElement.getAttribute( 'data-ispcl-content' ),
                    uid: viewElement.getAttribute( 'data-uid' )
                } );
            }
        } );

        conversion.for( 'dataDowncast' ).elementToElement( {
            model: {
                name: 'isPencil',
                attributes: [ 'hasBorder', 'position' ]
            },
            view: (modelElement, { writer: viewWriter } ) => {
                return viewWriter.createContainerElement( 'div', {
                     class: getIsPencilViewClasses( modelElement )
                } );
            }
        } );

        conversion.for( 'dataDowncast' ).elementToElement( {
            model: {
                name: 'isPencilCanvas',
                attributes: [ 'width', 'height', 'content', 'uid' ]
            },
            view: (modelElement, { writer: viewWriter } ) => {
                return viewWriter.createEditableElement( 'canvas', getIsPencilCanvasViewConfig( modelElement ) );
            }
        } );

        conversion.for( 'editingDowncast' ).elementToElement( {
            model: {
                name: 'isPencil',
                attributes: [ 'hasBorder', 'position']
            },
            view: (modelElement, { writer: viewWriter } ) => {
                // class is a string with all classes to be used in addition to automatic CKEditor classes
                const isPencilDiv = viewWriter.createContainerElement( 'div', { class: getIsPencilViewClasses( modelElement ) } );
                // return toWidget( isPencilDiv, viewWriter, { label: 'isPencil widget', hasSelectionHandle: true });
                const widget = toWidget( isPencilDiv, viewWriter, { label: 'isPencil widget', hasSelectionHandle: true });
                widget.on( 'change', () => console.log('change in widget'));
                return widget;
            }
        } );

        conversion.for( 'editingDowncast' ).elementToElement( {
            model: {
                name: 'isPencilCanvas',
                attributes: [ 'width', 'height', 'content', 'uid' ]
            },
            view: (modelElement, { writer: viewWriter } ) => {
                return viewWriter.createEditableElement( 'canvas', getIsPencilCanvasViewConfig( modelElement ) );
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
 * Returns a string with space separated CSS classes for the container isPencil div
 * 
 * @param {@ckeditor/ckeditor5-engine/src/model/element} modelElement 
 * @returns 
 */
function getIsPencilViewClasses( modelElement ) {
    // This class is present in any case. It fits the div to the canvas and is the pattere matching filter
    let classes = 'ispcl-fitcontent'; 
    // Add the positioning class. It is present in any case
    classes += ' ' + getPositionClass( modelElement.getAttribute( 'position' ) );
    // Add a border to the container div, only if required. In absence of this class there is no border 
    const hasBorder = modelElement.getAttribute( 'hasBorder' );
    if ( hasBorder && hasBorder == true ) {                  
        classes += ' ispcl-thinborder';
    }
    return classes;
}

/**
 * The configuration element for the ispencilCanvas
 * 
 * @param {@ckeditor/ckeditor5-engine/src/model/element} modelElement 
 * @returns 
 */
function getIsPencilCanvasViewConfig( modelElement ) {
    let config = {
        class: 'ispcl-canvas', // fake class needed for pattern identification. Could be used to color the canvas
        width: modelElement.getAttribute( 'width' ),
        height: modelElement.getAttribute( 'height' )
    } 
    // Due to the '-' these must be treated separately
    config['data-ispcl-content'] = modelElement.getAttribute( 'content' );
    config['data-uid'] = modelElement.getAttribute( 'uid' );
    return config;
}