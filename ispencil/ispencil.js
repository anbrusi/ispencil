// ispencil/ispencil.js

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import IsPencilEditing from './ispencilediting';
import IsPencilToolbar from './ispenciltoolbar';
import IsPencilUI from './ispencilui';
import IsCanvas from './ispen/iscanvas';

export default class IsPencil extends Plugin {

	static get pluginName() {
		return 'IsPencil';
	}

    static get requires() {
        return [ IsPencilEditing, IsPencilToolbar, IsPencilUI, IsCanvas ];
    }
}