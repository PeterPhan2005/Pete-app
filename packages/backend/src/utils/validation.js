import { ValidationError } from './errorHandler.js';

// Password validation utility
export const validatePassword = (password) => {
  const minLength = 8;
  const maxLength = 128;

  if (!password) {
    throw new ValidationError('Mật khẩu không được để trống', 'password');
  }

  if (password.length < minLength) {
    throw new ValidationError(`Mật khẩu phải có ít nhất ${minLength} ký tự`, 'password');
  }

  if (password.length > maxLength) {
    throw new ValidationError(`Mật khẩu không được vượt quá ${maxLength} ký tự`, 'password');
  }

  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    throw new ValidationError('Mật khẩu phải chứa ít nhất một chữ hoa', 'password');
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    throw new ValidationError('Mật khẩu phải chứa ít nhất một chữ thường', 'password');
  }

  // Check for at least one digit
  if (!/\d/.test(password)) {
    throw new ValidationError('Mật khẩu phải chứa ít nhất một chữ số', 'password');
  }

  // Check for at least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    throw new ValidationError('Mật khẩu phải chứa ít nhất một ký tự đặc biệt (!@#$%^&*...)', 'password');
  }

  return true;
};

// Email validation utility
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!email) {
    throw new ValidationError('Email không được để trống', 'email');
  }

  if (!emailRegex.test(email)) {
    throw new ValidationError('Email không hợp lệ', 'email');
  }

  return true;
};

// Username validation utility
export const validateUsername = (username) => {
  const minLength = 3;
  const maxLength = 30;
  const usernameRegex = /^[a-zA-Z0-9_]+$/;

  if (!username) {
    throw new ValidationError('Tên đăng nhập không được để trống', 'username');
  }

  if (username.length < minLength) {
    throw new ValidationError(`Tên đăng nhập phải có ít nhất ${minLength} ký tự`, 'username');
  }

  if (username.length > maxLength) {
    throw new ValidationError(`Tên đăng nhập không được vượt quá ${maxLength} ký tự`, 'username');
  }

  if (!usernameRegex.test(username)) {
    throw new ValidationError('Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới', 'username');
  }

  return true;
};
