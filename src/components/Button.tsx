import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary';

/** Also for links styled as buttons: <Link className={buttonClass('primary')}>. */
export function buttonClass(variant: ButtonVariant = 'secondary', small = false): string {
  return [styles.button, styles[variant], small && styles.small].filter(Boolean).join(' ');
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  small?: boolean;
}

export function Button({ variant, small, className, type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      className={`${buttonClass(variant, small)} ${className ?? ''}`}
      {...props}
    />
  );
}
