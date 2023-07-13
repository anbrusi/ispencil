// iscmdpanel
import { DropdownPanelView } from '@ckeditor/ckeditor5-ui';
import IsCmdToolbar from './iscmdtoolbar.js';

// Icons, seems they must be imported individually, at least CKEditor does so in ckeditor5-core/index.js
import eraseIcon from '@ckeditor/ckeditor5-core/theme/icons/eraser.svg';
// Own icons, partially handcrafted
import freePenIcon from '../../theme/icons/free-line.svg';
import straightLinesIcon from '../../theme/icons/normal-line.svg';
import blackIcon from '../../theme/icons/black-tile.svg';
import redIcon from '../../theme/icons/red-tile.svg';
import greenIcon from '../../theme/icons/green-tile.svg';
import blueIcon from '../../theme/icons/blue-tile.svg';
import thinIcon from '../../theme/icons/thin.svg';
import mediumIcon from '../../theme/icons/medium.svg';
import thickIcon from '../../theme/icons/thick.svg';
import xthickIcon from '../../theme/icons/xthick.svg';



export default class IsCmdPanel extends DropdownPanelView {

    /**
     * 
     * @param {*} locale 
     */
    constructor( locale ) {
        super( locale );
       
        const modeToolbar = new IsCmdToolbar( locale, [
            {
                customid: 'freePen',
                labeltext: 'free pen mode',
                tooltip: true,
                icon: freePenIcon
            },
            {
                customid: 'straightLines',
                labeltext: 'straight lines mode',
                tooltip: true,
                icon: straightLinesIcon
            },
            {
                customid: 'erase',
                labeltext: 'erase mode',
                tooltip: true,
                icon: eraseIcon
            }
        ], { defaultCustomid: 'freePen' } );
        this.bind('mode').to(modeToolbar, 'activeCustomid');

        const colorToolbar = new IsCmdToolbar( locale, [
            {
                customid: 'black',
                labeltext: 'set black color',
                tooltip: true,
                icon: blackIcon
            },
            {
                customid: 'red',
                labeltext: 'set red color',
                tooltip: true,
                icon: redIcon
            },
            {
                customid: 'green',
                labeltext: 'set green color',
                tooltip: true,
                icon: greenIcon
            },
            {
                customid: 'blue',
                labeltext: 'set blue color',
                tooltip: true,
                icon: blueIcon
            }
        ], { defaultCustomid: 'black' } );
        this.bind('color').to(colorToolbar,'activeCustomid');

        const strokeToolbar = new IsCmdToolbar( locale, [
            {
                customid: 'thin',
                labeltext: 'set thin stroke',
                tooltip: true,
                icon: thinIcon
            },
            {
                customid: 'medium',
                labeltext: 'set medium stroke',
                tooltip: true,
                icon: mediumIcon
            },
            {
                customid: 'thick',
                labeltext: 'set thick stroke',
                tooltip: true,
                icon: thickIcon
            },
            {
                customid: 'xthick',
                labeltext: 'set xthick stroke',
                tooltip: true,
                icon: xthickIcon
            }
        ], { defaultCustomid: 'medium' } );
        this.bind('stroke').to(strokeToolbar, 'activeCustomid');

        this.setTemplate( {
            tag: 'div',
            attributes: {
                style: {
                    width: '180px'
                }
            },
            children:[
                modeToolbar,
                colorToolbar,
                strokeToolbar
            ]
        } );
    }
}