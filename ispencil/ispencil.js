// ispencil/ispencil.js

import IsPencilEditing from './ispencilediting';
import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import IsPencilUI from './ispencilui';
import IsPencilToolbar from './ispenciltoolbar';
import IsResize from './resize/isresize';

export default class IsPencil extends Plugin {

	static get pluginName() {
		return 'IsPencil';
	}

    static get requires() {
        return [ IsPencilEditing, IsPencilUI, IsPencilToolbar, IsResize ];
    }
}