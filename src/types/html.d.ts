
// Extend the HTMLInputElement interface to include directory selection attributes
declare namespace React {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string | boolean;
    directory?: string | boolean;
  }
}

// For HTMLEmbedElement type definition
declare namespace React {
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    // extends React's HTMLAttributes
  }
}

// Extend Window interface to support cameraStream
declare global {
  interface Window {
    cameraStream?: MediaStream;
  }
}
