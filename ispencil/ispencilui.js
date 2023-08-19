// ispencil/ispencilui.js

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import ButtonView from '@ckeditor/ckeditor5-ui/src/button/buttonview';
import isPencilIcon from '../theme/icons/pencil_8.svg';
import leftPosIcon from '../theme/icons/ispcl-i-floatleft.svg';
import centerPosIcon from '../theme/icons/ispcl-i-center.svg';
import rightPosIcon from '../theme/icons/ispcl-i-floatright.svg';
import IsPencilToolbar from './ispenciltoolbar';
import SplitButtonView from '@ckeditor/ckeditor5-ui/src/dropdown/button/splitbuttonview';
import pencilIcon from '@ckeditor/ckeditor5-core/theme/icons/pencil.svg';
import IsCmdPanel from './ispen/iscmdpanel';
import { createDropdown } from '@ckeditor/ckeditor5-ui';
import IsCanvas from './ispen/iscanvas';

export default class IsPencilUI extends Plugin {

    static get pluginName() {
		return 'IsPencilUI';
	}

    init() {
        // console.log( 'IsPencilUI#init() got called' );
        
        const editor = this.editor;
        const t = editor.t;
        const isCanvas = editor.plugins.get( IsCanvas );
        // const isPencilToolbar = editor.plugins.get( IsPencilToolbar );

        // This is the button in the editor toolbar
        /*
        editor.ui.componentFactory.add( 'isPencil', locale => {
            const command = editor.commands.get( 'isPencilInsertCommand' );
            const buttonView = new ButtonView( locale );

            buttonView.set( {
                label: t( 'IsPencil' ),
                icon: isPencilIcon,
                tooltip: true
            } );
            // Bind the state of the button to the command
            buttonView.bind( 'isOn', 'isEnabled' ).to( command, 'value', 'isEnabled');
            // Execute the command when the button is clicked
            this.listenTo( buttonView, 'execute', () => editor.execute( 'isPencilInsertCommand' ) );
            return buttonView;
        } );
        */

        // Pencil insert button with dropdown in the editor toolbar
        editor.ui.componentFactory.add( 'isPencilCockpit', locale => {
            const command = editor.commands.get( 'isPencilInsertCommand' );
            const dropdown = createDropdown( locale, SplitButtonView );
            // At this point, we should not used the unqualified buttonView, since it duplicates to both buttons action and arrow
            dropdown.buttonView.actionView.set( {
                label: t( 'IsPencil' ),
                icon: pencilIcon,
                tooltip: true
            } );
            // dropdown.bind('isEnabled').to(command);
            dropdown.buttonView.actionView.on( 'execute', () => editor.execute( 'isPencilInsertCommand' ) );
            // console.log( 'dropdown', dropdown );
            const commandPanelView = new IsCmdPanel( locale, dropdown );
            dropdown.panelView.children.add( commandPanelView );
            // console.log( 'commandPanelView', commandPanelView );
            this.listenTo(commandPanelView, 'change:mode', () => isCanvas.changeMode(commandPanelView.mode ) );
            this.listenTo(commandPanelView, 'change:color', () => isCanvas.changeColor(commandPanelView.color ) );
            this.listenTo(commandPanelView, 'change:stroke', () => isCanvas.changeStroke(commandPanelView.stroke ) );
            return dropdown;
        } );

        /**
         * The following are the buttons for the widget baloon toolbar
         * They show the current style of the related widget, by highlighting the corresponding icon.
         * This is achieved, by binding the icon view's isOn to the properties *.PosActive of IsPencilToolbar
         */

        /*
        editor.ui.componentFactory.add( 'isPencilLeft', locale => {
            const buttonView = new ButtonView( locale );

            buttonView.set( {
                label: t( 'isPencil float left' ),
                icon: leftPosIcon,
                tooltip: true
            } );
            buttonView.bind( 'isOn' ).to( isPencilToolbar, 'leftPosActive' );
            this.listenTo( buttonView, 'execute', () => editor.execute( 'isPencilPosCommand', 'left' ) );
            return buttonView;
        } );

        
         editor.ui.componentFactory.add( 'isPencilCenter', locale => {
            const buttonView = new ButtonView( locale );

            buttonView.set( {
                label: t( 'isPencil center' ),
                icon: centerPosIcon,
                tooltip: true
            } );
            buttonView.bind( 'isOn' ).to( isPencilToolbar, 'centerPosActive' );
            // Execute the command when the button is clicked
            this.listenTo( buttonView, 'execute', () => editor.execute( 'isPencilPosCommand', 'center' ) );
            return buttonView;
        } );


        editor.ui.componentFactory.add( 'isPencilRight', locale => {
            const buttonView = new ButtonView( locale );

            buttonView.set( {
                label: t( 'isPencil float right' ),
                icon: rightPosIcon,
                tooltip: true
            } );
            buttonView.bind( 'isOn' ).to( isPencilToolbar, 'rightPosActive' );
            this.listenTo( buttonView, 'execute', () => editor.execute( 'isPencilPosCommand', 'right' ) );
            return buttonView;
        } );
        */
    }

}