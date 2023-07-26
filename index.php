<?php
class dispatcher {

    /**
     * Document root relative path of test documents
     */
    const TESTDOCUMENTS = './testdocuments/';

    /**
     * Array elements are names of properties persisted by setting hidden POSTs for their values.
     * $this->setPesistentValues adds the content of these properties to HTML as hidden POSTs
     * $this->getPersistentValues sets these properties from the hidden POSTs if present.
     */
    const PERSITENT_VARS = ['currentView', 'currentDocument'];

    /**
     * Name of the current view
     * 
     * @var string
     */
    private $currentView = 'testdocumentView';
    /**
     * Name of the file holding the current document
     * 
     * @var string
     */
    private $currentDocument = 'newDocument';


    /**
     * Current document content
     * 
     * @var string
     */
    private $currentHtml = '';

    private function header():string {
        $html = '';
        $html .= '<head>';
        $html .= '<meta charset="UTF-8">';
        $html .= '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
        $html .= '<title>ispencil5_2</title>';
        $html .= '<link rel="stylesheet" href="index.css" />';
        // Import the classic editor script for all pages. Instantiation is made in pages, that need it
        $html .= '<script src="./build/ckeditor.js"></script>';
        $html .= '<script src="./node_modules/@ckeditor/ckeditor5-inspector/build/inspector.js"></script>';
        $html .= '</head>';
        return $html;
    }
    private function body():string {
        $html = '';
        $html .= '<body>';
        $html .= '<h1>isPencil5_2</h1>';
        $html .= '<form action="index.php" method="POST" name="ispencil5_2">';
        // Get properties transmitted ffrom previous view
        $this->getPersistentValues();
        // Handle POST's of previous view
        $html .= $this->handle();
        // Render the current view
        $html .= $this->render();
        // Store persistent properties for the benefit of the next view
        $html .= $this->setPersistentValues();
        $html .= '</form>';
        $html .= '</body>';
        return $html;
    }
    /**
     * Retrieves all hidden values for variables in self::PERSISTENT_VARS
     * 
     * @return void 
     */
    private function getPersistentValues() {
        foreach (self::PERSITENT_VARS as $var) {
            if (isset($_POST[$var])) {
                $this->$var = $_POST[$var];
            }
        }
    }
    /**
     * Returns HTML with hidden values for all variables in self::PERSISTENT_VARS
     * 
     * @return string 
     */
    private function setPersistentValues():string {
        $html = '';
        foreach (self::PERSITENT_VARS as $var) {
            $html .= '<input type="hidden", name ="'.$var.'" value="'.$this->$var.'" />';
        }
        return $html;
    }
    public function dispatch() {
        $html = '';
        $html .= '<!DOCTYPE html>';
        $html .= '<html>';
        $html .= $this->header();
        $html .= $this->body();
        $html .= '</html>';
        echo $html;
    }

    /**
     * Returns the view for 'testdocumentView'. This is the initial view, allowing to load an existing document or create a new one
     * 
     * @return string 
     */
    private function testdocumentView():string {
        $html = '';
        $html .= '<fieldset>';
        $html .= '<legend>test documents</legend>';
        $content = scandir(self::TESTDOCUMENTS);
        if ($content !== false) {
            foreach ($content as $file) {
                if ($file != '.' && $file != '..') {
                    $html .= '<input type="radio" name="testdocuments" value="'.$file.'" id="'.$file.'" />';
                    $html .= '<label for "'.$file.'">&nbsp;'.$file.'</label><br>';
                }
            }
        }
        $html .= '</fieldset>';
        $html .= '<div class="smallspacer"></div>';
        $html .= '<input type="submit" name="load" value="load" />';
        $html .= '<input type="submit" name="new" value="new document" />';
        $html .= '<input type="submit" name="view" value="view" />'; 
        return $html;
    }
    private function createEditorScript():string {
        $txt = '';
        $txt .= <<<'EOD'
        let iseditor;
        ClassicEditor
            .create( document.querySelector( '#editor' ), {
                // Configuration details.
                isPencil: {
                    width: 800,
                    height: 200,
                    hasBorder: true,
                    position: "center"
                }
            } )
            .then( editor => {
                console.log('editor ready', editor); 
                CKEditorInspector.attach( editor );
                iseditor = editor;
            } )
            .catch( error => {
                console.error( error );
            });
        EOD;
        return $txt;
    }
    /**
     * Returns the view 'editorView'. Displays the editor and the name of the current document, allowing to store it.
     * 
     * @return string 
     */
    private function editorView():string {
        $html = '';
        $html .= '<div>';
        $html .= 'Current document:&nbsp;&nbsp;';
        $html .= '<input type="text", name="docuname" value="'.$this->currentDocument.'" />';
        $html .= '</div>';
        $html .= '<div class="smallspacer"></div>';
        $html .= '<textarea id="editor" name="content">'.$this->currentHtml.'</textarea>';
        $html .= '<script>';
        $html .= $this->createEditorScript();
        $html .= '</script>';
        $html .= '<div class="smallspacer"></div>';
        $html .= '<input type="submit" name="escape" value="escape" />';
        $html .= '<input type="submit" name="store" value="store" />';
        return $html;
    }

    /**
     * Returns the view 'viewingWiew'
     * 
     * @return string 
     */
    private function viewingView():string {
        $html = '';
        $html .= '<div>';
        $html .= 'View of document:&nbsp;&nbsp;'.$this->currentDocument;
        $html .= '<div style="margin: 20px; padding: 10px; border: 1px solid blue;">';
        $html .= $this->currentHtml;
        $html .= '</div>';
        $html .= '<div class="smallspacer"></div>';
        $html .= '<input type="submit" name="escape" value="escape" />';
        return $html;
    }

    /**
     * Returns HTML for the view $this->currentView
     * 
     * @return string 
     */
    private function render():string {
        switch ($this->currentView) {
            case 'testdocumentView':
                return $this->testdocumentView();
            case 'editorView':
                return $this->editorView();
            case 'viewingView';
                return $this->viewingView();
            default:
                return 'missing view';
        }
    }

    /**
     * Handler responding to POST of testdocumentView. This view shows available documents
     * 
     * @return void 
     */
    private function handleTestdocument() {
        if (isset($_POST['load']) && isset($_POST['testdocuments'])) {
            $this->currentHtml = file_get_contents(self::TESTDOCUMENTS.$_POST['testdocuments']);
            $this->currentDocument = $_POST['testdocuments'];
            $this->currentView = 'editorView';
        } elseif (isset($_POST['new'])) {
            $this->currentView = 'editorView';
        } elseif ( isset($_POST['view']) && isset($_POST['testdocuments']) ) {
            $this->currentHtml = file_get_contents(self::TESTDOCUMENTS.$_POST['testdocuments']);
            $this->currentDocument = $_POST['testdocuments'];
            $this->currentView = 'viewingView';
        }
    }
    /**
     * Handler responding to POST of editorView
     * 
     * @return void 
     */
    private function handleEditor() {
        if (isset($_POST['escape'])) {
            $this->currentView = 'testdocumentView';
        } elseif (isset($_POST['store'])) {
            file_put_contents(self::TESTDOCUMENTS.$_POST['docuname'], $_POST['content']);
            $this->currentView = 'testdocumentView';
        }
    }

    private function handleView() {
        if (isset($_POST['escape'])) {
            $this->currentView = 'testdocumentView';
        }
    }

    private function handle() {
        switch ($this->currentView) {
            case 'testdocumentView':
                $this->handleTestdocument();
                break;
            case 'editorView';
                $this->handleEditor();
                break;
            case 'viewingView';
                $this->handleView();
                break;
            default:
                echo 'missing handler';
                die;
        }
    }

}
$dispatcher = new dispatcher();
$dispatcher->dispatch();
