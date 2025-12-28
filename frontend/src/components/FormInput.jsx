/**
 * Form Input Component with Validation
 * Hata gösterimi ve validasyon desteği olan gelişmiş input component
 */
import { AlertCircle } from 'lucide-react'

export const FormInput = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  placeholder,
  required = false,
  disabled = false,
  helpText,
  className = '',
  ...props
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className={`input ${
          error
            ? 'border-red-500 focus:ring-red-500 dark:border-red-400'
            : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        {...props}
      />

      {error && (
        <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {helpText && !error && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{helpText}</p>
      )}
    </div>
  )
}

export const FormTextarea = ({
  label,
  name,
  value,
  onChange,
  error,
  placeholder,
  required = false,
  disabled = false,
  helpText,
  rows = 4,
  className = '',
  ...props
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <textarea
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        className={`input ${
          error
            ? 'border-red-500 focus:ring-red-500 dark:border-red-400'
            : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        {...props}
      />

      {error && (
        <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {helpText && !error && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{helpText}</p>
      )}
    </div>
  )
}

export const FormSelect = ({
  label,
  name,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  helpText,
  options = [],
  placeholder = 'Seçiniz...',
  className = '',
  ...props
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`input ${
          error
            ? 'border-red-500 focus:ring-red-500 dark:border-red-400'
            : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {error && (
        <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {helpText && !error && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{helpText}</p>
      )}
    </div>
  )
}

export const FormCheckbox = ({
  label,
  name,
  checked,
  onChange,
  error,
  disabled = false,
  helpText,
  className = '',
  ...props
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-start gap-3">
        <input
          id={name}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className={`mt-1 w-4 h-4 text-primary-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500 ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
          {...props}
        />
        {label && (
          <label
            htmlFor={name}
            className={`text-sm text-gray-700 dark:text-gray-300 ${
              disabled ? 'opacity-50' : 'cursor-pointer'
            }`}
          >
            {label}
          </label>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-sm ml-7">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {helpText && !error && (
        <p className="text-sm text-gray-500 dark:text-gray-400 ml-7">
          {helpText}
        </p>
      )}
    </div>
  )
}

export default {
  FormInput,
  FormTextarea,
  FormSelect,
  FormCheckbox,
}
