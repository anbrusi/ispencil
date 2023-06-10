// ispencil/ispencilui.js

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import ButtonView from '@ckeditor/ckeditor5-ui/src/button/buttonview';
import isPencilIcon from '../theme/icons/pencil_8.svg';
import leftPosIcon from '../theme/icons/ispcl-i-floatleft.svg';
import centerPosIcon from '../theme/icons/ispcl-i-center.svg';
import rightPosIcon from '../theme/icons/ispcl-i-floatright.svg';
import IsPencilToolbar from './ispenciltoolbar';

export default class IsPencilUI extends Plugin {

    static get pluginName() {
		return 'IsPencilUI';
	}

    init() {
        // console.log( 'IsPencilUI#init() got called' );
        
        const editor = this.editor;
        const t = editor.t;
        const isPencilToolbar = editor.plugins.get( IsPencilToolbar );

        // This is the button in the editor toolbar
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

        /**
         * The following are the buttons for the widget baloon toolbar
         * They show the current style of the related widget, by highlighting the corresponding icon.
         * This is achieved, by binding the icon view's isOn to the properties *.PosActive of IsPencilToolbar
         */

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
            buttonView.bind( 'isOn' ).to( isPencilToolbar, 'centePosActive' );
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

    }

}