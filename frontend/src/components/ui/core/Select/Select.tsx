import React, { forwardRef, useState, useRef, useEffect, useMemo } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { SelectProps, SelectOption, ValidationState } from '../types';
import { Theme } from '../../../../theme/themes';
import {
  focusStyles,
  disabledStyles,
  transitionStyles,
  sizeMap,
  generateId,
  truncate,
} from '../utils';

const getValidationStyles = (theme: Theme, state: ValidationState) => {
  const states = {
    default: css``,
    error: css`
      border-color: ${theme.colors.error.main};
      
      &:hover:not(:disabled) {
        border-color: ${theme.colors.error.dark};
      }
      
      &:focus-within {
        outline-color: ${theme.colors.error.main};
        border-color: ${theme.colors.error.main};
      }
    `,
    success: css`
      border-color: ${theme.colors.success.main};
      
      &:hover:not(:disabled) {
        border-color: ${theme.colors.success.dark};
      }
      
      &:focus-within {
        outline-color: ${theme.colors.success.main};
        border-color: ${theme.colors.success.main};
      }
    `,
    warning: css`
      border-color: ${theme.colors.warning.main};
      
      &:hover:not(:disabled) {
        border-color: ${theme.colors.warning.dark};
      }
      
      &:focus-within {
        outline-color: ${theme.colors.warning.main};
        border-color: ${theme.colors.warning.main};
      }
    `,
  };
  
  return states[state];
};

const SelectWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const Label = styled.label<{ theme: Theme; required?: boolean }>`
  display: block;
  margin-bottom: ${({ theme }) => theme.spacing[2]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  
  ${({ required }) => required && css`
    &::after {
      content: ' *';
      color: currentColor;
    }
  `}
`;

const SelectContainer = styled.div<{
  theme: Theme;
  size: NonNullable<SelectProps['size']>;
  validationState: ValidationState;
  disabled?: boolean;
  isOpen: boolean;
}>`
  position: relative;
  display: flex;
  align-items: center;
  background-color: ${({ theme }) => theme.colors.background.paper};
  border: 2px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  
  ${({ theme }) => transitionStyles(theme, ['border-color', 'box-shadow', 'background-color'])}
  
  /* Size styles */
  ${({ size }) => css`
    min-height: ${sizeMap[size].height};
    font-size: ${sizeMap[size].fontSize};
    padding: ${sizeMap[size].padding};
  `}
  
  /* Validation styles */
  ${({ theme, validationState }) => getValidationStyles(theme, validationState)}
  
  /* Hover state */
  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.primary.main};
  }
  
  /* Focus state */
  ${({ theme }) => focusStyles(theme)}
  
  /* Open state */
  ${({ isOpen, theme }) => isOpen && css`
    border-color: ${theme.colors.primary.main};
    outline: 2px solid ${theme.colors.primary.main};
    outline-offset: 2px;
  `}
  
  /* Disabled state */
  ${({ disabled, theme }) => disabled && css`
    ${disabledStyles(theme)}
    background-color: ${theme.colors.background.default};
  `}
`;

const SelectDisplay = styled.div<{ theme: Theme; hasValue: boolean }>`
  flex: 1;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  min-width: 0;
  color: ${({ theme, hasValue }) => hasValue ? theme.colors.text.primary : theme.colors.text.disabled};
  
  ${truncate}
`;

const SelectIcon = styled.span<{ theme: Theme; isOpen: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: ${({ theme }) => theme.colors.text.secondary};
  transform: ${({ isOpen }) => isOpen ? 'rotate(180deg)' : 'rotate(0deg)'};
  transition: transform ${({ theme }) => theme.transitions.duration.base} ${({ theme }) => theme.transitions.timing.ease};
`;

const Dropdown = styled.div<{
  theme: Theme;
  isOpen: boolean;
  maxHeight?: number;
}>`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: ${({ theme }) => theme.zIndex.dropdown};
  background-color: ${({ theme }) => theme.colors.background.paper};
  border: 2px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  max-height: ${({ maxHeight }) => maxHeight ? `${maxHeight}px` : '300px'};
  overflow-y: auto;
  opacity: ${({ isOpen }) => isOpen ? 1 : 0};
  visibility: ${({ isOpen }) => isOpen ? 'visible' : 'hidden'};
  transform: ${({ isOpen }) => isOpen ? 'translateY(0)' : 'translateY(-10px)'};
  
  ${({ theme }) => transitionStyles(theme, ['opacity', 'visibility', 'transform'])}
`;

const SearchInput = styled.input<{ theme: Theme }>`
  width: 100%;
  padding: ${({ theme }) => theme.spacing[3]};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};
  background-color: transparent;
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
  outline: none;
  
  &::placeholder {
    color: ${({ theme }) => theme.colors.text.disabled};
  }
  
  &:focus {
    border-bottom-color: ${({ theme }) => theme.colors.primary.main};
  }
`;

const OptionGroup = styled.div<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[2]} 0;
  
  &:not(:first-of-type) {
    border-top: 1px solid ${({ theme }) => theme.colors.divider};
  }
`;

const OptionGroupLabel = styled.div<{ theme: Theme }>`
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.secondary};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.wide};
`;

const Option = styled.div<{
  theme: Theme;
  isSelected: boolean;
  isHighlighted: boolean;
  disabled?: boolean;
}>`
  padding: ${({ theme }) => `${theme.spacing[3]} ${theme.spacing[3]}`};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  
  ${({ theme }) => transitionStyles(theme, ['background-color', 'color'])}
  
  /* Selected state */
  ${({ isSelected, theme }) => isSelected && css`
    background-color: ${theme.colors.primary.main}20;
    color: ${theme.colors.primary.main};
    font-weight: ${theme.typography.fontWeight.medium};
  `}
  
  /* Highlighted state */
  ${({ isHighlighted, theme }) => isHighlighted && css`
    background-color: ${theme.colors.divider};
  `}
  
  /* Hover state */
  &:hover:not(:disabled) {
    background-color: ${({ theme }) => theme.colors.divider};
  }
  
  /* Disabled state */
  ${({ disabled, theme }) => disabled && css`
    ${disabledStyles(theme)}
    color: ${theme.colors.text.disabled};
  `}
`;

const Checkbox = styled.span<{ theme: Theme; checked: boolean }>`
  width: 18px;
  height: 18px;
  border: 2px solid ${({ theme, checked }) => checked ? theme.colors.primary.main : theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background-color: ${({ theme, checked }) => checked ? theme.colors.primary.main : 'transparent'};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
  ${({ theme }) => transitionStyles(theme, ['border-color', 'background-color'])}
  
  &::after {
    content: '';
    width: 12px;
    height: 12px;
    background-color: ${({ theme }) => theme.colors.primary.contrast};
    mask: url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' fill='currentColor' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3E%3C/svg%3E") center/contain no-repeat;
    opacity: ${({ checked }) => checked ? 1 : 0};
    transform: scale(${({ checked }) => checked ? 1 : 0.5});
    ${({ theme }) => transitionStyles(theme, ['opacity', 'transform'])}
  }
`;

const HelperText = styled.div<{
  theme: Theme;
  validationState: ValidationState;
}>`
  margin-top: ${({ theme }) => theme.spacing[1]};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
  color: ${({ theme, validationState }) => {
    switch (validationState) {
      case 'error':
        return theme.colors.error.main;
      case 'success':
        return theme.colors.success.main;
      case 'warning':
        return theme.colors.warning.main;
      default:
        return theme.colors.text.secondary;
    }
  }};
`;

const ClearButton = styled.button<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[1]};
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.text.secondary};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  
  ${({ theme }) => transitionStyles(theme, ['color', 'background-color'])}
  
  &:hover {
    color: ${({ theme }) => theme.colors.text.primary};
    background-color: ${({ theme }) => theme.colors.divider};
  }
  
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary.main};
    outline-offset: 2px;
  }
`;

export const Select = forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      size = 'medium',
      options,
      label,
      helperText,
      validationState = 'default',
      validationMessage,
      placeholder = 'Select...',
      clearable = false,
      searchable = false,
      multiple = false,
      value,
      onChange,
      onClear,
      maxHeight,
      loading = false,
      disabled = false,
      required = false,
      testId,
      className,
      id: providedId,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const id = providedId || generateId('select');
    
    // Normalize value to array for consistent handling
    const selectedValues = useMemo(() => {
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    }, [value]);
    
    // Filter options based on search term
    const filteredOptions = useMemo(() => {
      if (!searchTerm) return options;
      
      return options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }, [options, searchTerm]);
    
    // Group options by group property
    const groupedOptions = useMemo(() => {
      const groups: { [key: string]: SelectOption[] } = { '': [] };
      
      filteredOptions.forEach(option => {
        const group = option.group || '';
        if (!groups[group]) {
          groups[group] = [];
        }
        groups[group].push(option);
      });
      
      return groups;
    }, [filteredOptions]);
    
    // Get display text
    const displayText = useMemo(() => {
      if (selectedValues.length === 0) return placeholder;
      
      const selectedOptions = options.filter(opt => 
        selectedValues.includes(opt.value)
      );
      
      if (multiple) {
        return selectedOptions.length > 0
          ? `${selectedOptions.length} selected`
          : placeholder;
      }
      
      return selectedOptions[0]?.label || placeholder;
    }, [selectedValues, options, multiple, placeholder]);
    
    const displayHelperText = validationMessage || helperText;
    const showClearButton = clearable && selectedValues.length > 0 && !disabled && !loading;
    
    const handleToggle = () => {
      if (!disabled && !loading) {
        setIsOpen(!isOpen);
        if (!isOpen && searchable) {
          setTimeout(() => searchInputRef.current?.focus(), 0);
        }
      }
    };
    
    const handleOptionClick = (option: SelectOption) => {
      if (option.disabled) return;
      
      if (multiple) {
        const newValues = selectedValues.includes(option.value)
          ? selectedValues.filter(v => v !== option.value)
          : [...selectedValues, option.value];
        
        onChange?.(newValues);
      } else {
        onChange?.(option.value);
        setIsOpen(false);
      }
      
      setSearchTerm('');
    };
    
    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.(multiple ? [] : '');
      onClear?.();
    };
    
    const handleKeyDown = (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
        case ' ':
          if (!isOpen) {
            e.preventDefault();
            handleToggle();
          } else if (highlightedIndex >= 0) {
            e.preventDefault();
            const allOptions = Object.values(groupedOptions).flat();
            handleOptionClick(allOptions[highlightedIndex]);
          }
          break;
          
        case 'Escape':
          if (isOpen) {
            e.preventDefault();
            setIsOpen(false);
          }
          break;
          
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else {
            const allOptions = Object.values(groupedOptions).flat();
            setHighlightedIndex(prev => 
              prev < allOptions.length - 1 ? prev + 1 : 0
            );
          }
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          if (isOpen) {
            const allOptions = Object.values(groupedOptions).flat();
            setHighlightedIndex(prev => 
              prev > 0 ? prev - 1 : allOptions.length - 1
            );
          }
          break;
      }
    };
    
    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      
      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }
    }, [isOpen]);
    
    // Reset highlighted index when dropdown closes
    useEffect(() => {
      if (!isOpen) {
        setHighlightedIndex(-1);
        setSearchTerm('');
      }
    }, [isOpen]);
    
    return (
      <SelectWrapper ref={ref} className={className} data-testid={testId}>
        {label && (
          <Label htmlFor={id} required={required}>
            {label}
          </Label>
        )}
        
        <SelectContainer
          ref={containerRef}
          size={size}
          validationState={validationState}
          disabled={disabled}
          isOpen={isOpen}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          tabIndex={disabled ? -1 : 0}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={`${id}-listbox`}
          aria-labelledby={label ? `${id}-label` : undefined}
          aria-invalid={validationState === 'error'}
          aria-describedby={displayHelperText ? `${id}-helper` : undefined}
        >
          <SelectDisplay hasValue={selectedValues.length > 0}>
            {displayText}
          </SelectDisplay>
          
          {showClearButton && (
            <ClearButton
              type="button"
              onClick={handleClear}
              aria-label="Clear selection"
              tabIndex={-1}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
              </svg>
            </ClearButton>
          )}
          
          <SelectIcon isOpen={isOpen}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </SelectIcon>
        </SelectContainer>
        
        <Dropdown
          id={`${id}-listbox`}
          role="listbox"
          isOpen={isOpen}
          maxHeight={maxHeight}
          aria-multiselectable={multiple}
        >
          {searchable && (
            <SearchInput
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              onClick={(e) => e.stopPropagation()}
            />
          )}
          
          {Object.entries(groupedOptions).map(([group, groupOptions]) => {
            if (groupOptions.length === 0) return null;
            
            return (
              <OptionGroup key={group}>
                {group && <OptionGroupLabel>{group}</OptionGroupLabel>}
                
                {groupOptions.map((option, index) => {
                  const globalIndex = Object.values(groupedOptions)
                    .flat()
                    .findIndex(opt => opt.value === option.value);
                  const isSelected = selectedValues.includes(option.value);
                  const isHighlighted = globalIndex === highlightedIndex;
                  
                  return (
                    <Option
                      key={option.value}
                      isSelected={isSelected}
                      isHighlighted={isHighlighted}
                      disabled={option.disabled}
                      onClick={() => handleOptionClick(option)}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={option.disabled}
                    >
                      {multiple && (
                        <Checkbox checked={isSelected} aria-hidden="true" />
                      )}
                      {option.label}
                    </Option>
                  );
                })}
              </OptionGroup>
            );
          })}
          
          {filteredOptions.length === 0 && (
            <Option isSelected={false} isHighlighted={false} disabled>
              No options found
            </Option>
          )}
        </Dropdown>
        
        {displayHelperText && (
          <HelperText
            id={`${id}-helper`}
            validationState={validationState}
            role={validationState === 'error' ? 'alert' : undefined}
          >
            {displayHelperText}
          </HelperText>
        )}
      </SelectWrapper>
    );
  }
);

Select.displayName = 'Select';