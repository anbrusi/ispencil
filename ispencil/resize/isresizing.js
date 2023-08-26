// isresizing.js

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import { Template } from '@ckeditor/ckeditor5-ui';

export default class IsResizing extends Plugin {

    init() {
        this._widgetViewElement = null;
    }

    createResizer( viewWriter ) {
        const resizerViewElement = viewWriter.createUIElement('div', {
            class: 'ck ck-reset_all ck-widget__resizer'
        }, function (domDocument) {
            // console.log( 'custom render function domDocument', domDocument );
            // domDocument is the whole HTML document (the entire displayed page), not only the editor or part of it
            const domElement = this.toDomElement(domDocument);
            // domElement is the just created resizer div
            console.log( 'custom render function domElement', domElement );
            const resizerPositions = ['bottom-right', 'bottom-left'];
            for (const currentPosition of resizerPositions) {
                let handle = new Template({
                    tag: 'div',
                    attributes: {
                        class: `ck-widget__resizer__handle ${getResizerClass(currentPosition)}`
                    }
                }).render();
                domElement.appendChild( handle );
            }
            return domElement;
        } );
        /*
        viewWriter.setStyle('width', '600px', resizerViewElement );
        viewWriter.setStyle( 'height', '100px', resizerViewElement );
        viewWriter.setStyle( 'display', 'block', resizerViewElement );
        */
        return resizerViewElement;
    }

    setCurrentWidget( canvasViewElement ) {
        if ( canvasViewElement === null ) {
            this._widgetViewElement = null;
        } else {
            this._widgetViewElement = canvasViewElement.parent;
            const resizerViewElement = this.getCurrentResizer();
            console.log( 'resizer', resizerViewElement );
            if ( resizerViewElement ) {
                this.editor.editing.view.change( viewWriter => {
                    let width = canvasViewElement.getAttribute( 'width' ) + 'px';
                    let height = canvasViewElement.getAttribute( 'height' ) + 'px';
                    viewWriter.setStyle('width', width, resizerViewElement );
                    viewWriter.setStyle( 'height', height, resizerViewElement );
                    viewWriter.setStyle( 'display', 'block', resizerViewElement );
                } );
            }
        }
        console.log( 'widgetViewElement', this._widgetViewElement );
    }

    getCurrentResizer() {
        if ( this._widgetViewElement === null ) {
            return null;
        }
        const children = this._widgetViewElement.getChildren();
        for ( let child of children ) {
            if ( child.hasClass( 'ck-widget__resizer' ) ) {
                return child;
            }
        }
        return null;
    }
}

// @private
// @param {String} resizerPosition Expected resizer position like `"top"`, `"bottomt"`.
// @returns {String} A prefixed HTML class name for the resizer element
function getResizerClass(resizerPosition) {
    // return `is-widget__resizer__handle-${resizerPosition}`;
    return `ck-widget__resizer__handle-${resizerPosition}`;
}