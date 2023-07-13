// iscmdbutton.js

import { ButtonView } from '@ckeditor/ckeditor5-ui'

export default class IsCmdButton extends ButtonView {

    constructor(locale, options) {
        super(locale);
        const bind = this.bindTemplate;
        this.extendTemplate({
            attributes: {
                'data-ispcl-customid': options.customid,
                style: {
                    backgroundColor: bind.to('bkcolor')
                }
            }
        });
        this.set( {
            label: this.t( options.labeltext ),
            icon: options.icon,
            tooltip: options.tooltip,
            activeCustomid: undefined,
            bkcolor: undefined
        } );
        this.bind('isOn').to(this, 'activeCustomid', () => { return this.activeCustomid == options.customid } );
        this.bind('bkcolor').to(this, 'activeCustomid', () => {
            // console.log('setting bk color');
            if (this.activeCustomid == options.customid) {
                return 'lime'
            } else {
                return undefined
            } 
        } );
        // this.on('change:activeCustomid', () => {console.log('activeCustomid changed to', this.activeCustomid)});
    }

}