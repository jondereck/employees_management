import { forwardRef } from "react";
import { cn } from "../../lib/utils";
import NavbarActions from "../navbar-actions";

export interface Button2Props
  extends React.ButtonHTMLAttributes<HTMLButtonElement> { }

const Button2 = forwardRef<HTMLButtonElement, Button2Props>(({
  className,
  children,
  disabled,
  type = "button",
  ...props
}, ref) => {
  return (
    <button
      className={cn(
      `
      w-auto 
      rounded-full 
      bg-black
      border
      border-transparent
      px-5 
      py-3 
      disabled:cursor-not-allowed 
      disabled:opacity-50
      text-white
      font-semibold
      hover:opacity-75
      transition
    `,
        disabled && 'opacity-75 cursor-not-allowed',
        className
      )}
      disabled={disabled}
      ref={ref}
      {...props}
    >
      {children}
    </button>
  );
});

Button2.displayName = "Button";

export default Button2