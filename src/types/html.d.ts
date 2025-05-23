
// Extend the HTMLInputElement interface to include directory selection attributes
interface HTMLInputAttributes extends React.InputHTMLAttributes<HTMLInputElement> {
  webkitdirectory?: string;
  directory?: string;
}
