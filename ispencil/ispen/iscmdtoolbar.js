// iscmdtoolbar.js


import { ToolbarView } from '@ckeditor/ckeditor5-ui';
import IsCmdButton from './iscmdbutton.js';

export default class IsCmdToolbar extends ToolbarView {

    /**
     * 
     * @param {*} locale 
     * @param {array} buttons array of button definition objects
     */
    constructor( locale, buttons, options ) {
        super( locale, buttons );

        this.set('activeCustomid', options.defaultCustomid);

        const bind = this.bindTemplate;

        if ( buttons?.length > 0 ) {
            // console.log('buttons', buttons );
            for (let buttondef of buttons) {
                const button = new IsCmdButton( locale, buttondef );
                button.bind('activeCustomid').to(this, 'activeCustomid');
                this.items.add( button );
            }
        }

        this.listenTo(this.focusTracker, 'change:focusedElement', this.activeCustomidHandler.bind(this) );
    }

    activeCustomidHandler(evt) {
        // Not only button can become a focused element. Buttons are filtered out using the customid
        const focusedItem = this.focusTracker.focusedElement;
        // console.log('focused item', focusedItem);
        if (focusedItem?.attributes) {
            // Tis is a named node map
            const customid = focusedItem.attributes.getNamedItem('data-ispcl-customid');
            if (customid?.nodeValue) {
                this.set('activeCustomid', customid.nodeValue);
                // console.log('IsCmdToolbar.activeCustomid changed to', customid.nodeValue);
            }
        }
    }
}