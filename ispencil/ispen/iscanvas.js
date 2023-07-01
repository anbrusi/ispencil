// ispen/iscanvas.js

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import { DomEmitterMixin, global } from '@ckeditor/ckeditor5-utils';

export default class IsCanvas extends Plugin {

    static get pluginName() {
        return 'IsCanvas';
    }

    init() {
        console.log( 'IsCanvas#init' );
        const domDocument = global.window.document;
        this._observer = new (DomEmitterMixin())();
        this._observer.listenTo( domDocument, 'pointerdown', this._pointerdownListener.bind( this ) );
        this._canvas = null;
    }

    _pointerdownListener(event, domEventData) {
        const srcElement = domEventData.srcElement;
        if (srcElement.classList.contains( 'ispcl-canvas' )) {
            const canvasViewElement = this.editor.editing.view.domConverter.mapDomToView( srcElement );
            const widgetViewElement = canvasViewElement.parent;
            if ( widgetViewElement ) {
                const widgetModelElement = this.editor.editing.mapper.toModelElement( widgetViewElement );
                console.log( 'widgetModelElement', widgetModelElement );
                this.editor.model.change( writer => writer.setSelection( widgetModelElement, 'on' ) );
                this._canvas = srcElement;
            }
        } else {
            this._canvas = null;
        }
    }
}