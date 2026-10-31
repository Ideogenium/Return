import { forwardRef, useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, type TextInput as NativeTextInput } from 'react-native';
import { TextInput, Button, HelperText, Chip, Text } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ui } from '../../config/theme.config';
import type { CreateItemDto, ItemCategory } from '../../types/api.types';
import { CATEGORY_I18N } from './ItemCard';

// ---------------------------------------------------------------------------
// DecimalInput — handles decimal point preservation during typing
// ---------------------------------------------------------------------------

interface DecimalInputProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  onBlur: () => void;
  error: boolean;
  testID: string;
  label: string;
  style: object[];
  outlineStyle: object;
  returnKeyType?: 'done';
  onSubmitEditing?: () => void;
}

const DecimalInput = forwardRef<NativeTextInput, DecimalInputProps>(function DecimalInput(
  {
    value,
    onChange,
    onBlur: fieldBlur,
    error,
    testID,
    label,
    style,
    outlineStyle,
    returnKeyType,
    onSubmitEditing,
  },
  ref,
) {
  const [rawText, setRawText] = useState(value != null ? String(value) : '');

  const handleChangeText = useCallback(
    (text: string) => {
      // Allow comma as decimal separator (French keyboards)
      const normalized = text.replace(',', '.');

      // Allow empty, digits, and one decimal point (possibly trailing)
      if (normalized !== '' && !/^\d*\.?\d*$/.test(normalized)) return;

      setRawText(normalized);

      // Only send to form if value is a complete number (no trailing dot)
      if (normalized === '' || normalized === '.') {
        onChange(undefined);
      } else if (!normalized.endsWith('.')) {
        const num = parseFloat(normalized);
        if (!isNaN(num)) onChange(num);
      }
    },
    [onChange],
  );

  const handleBlur = useCallback(() => {
    // Normalize display on blur (remove trailing dot)
    if (rawText.endsWith('.')) {
      const num = parseFloat(rawText);
      if (!isNaN(num)) {
        setRawText(String(num));
        onChange(num);
      } else {
        setRawText('');
        onChange(undefined);
      }
    }
    fieldBlur();
  }, [rawText, onChange, fieldBlur]);

  // Sync rawText when external value changes (e.g. form reset / default values)
  useEffect(() => {
    const expected = value != null ? String(value) : '';
    // Only sync if the external value actually differs and we're not mid-typing with trailing dot
    if (!rawText.endsWith('.') && rawText !== expected) {
      setRawText(expected);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayValue = rawText;

  return (
    <TextInput
      ref={ref}
      label={label}
      mode="outlined"
      keyboardType="decimal-pad"
      left={<TextInput.Icon icon="currency-eur" color="#A8B5BF" />}
      onBlur={handleBlur}
      onChangeText={handleChangeText}
      value={displayValue}
      error={error}
      testID={testID}
      style={style}
      outlineStyle={outlineStyle}
      returnKeyType={returnKeyType}
      onSubmitEditing={onSubmitEditing}
    />
  );
});

const CATEGORIES: ItemCategory[] = [
  'TOOLS',
  'ELECTRONICS',
  'BOOKS',
  'SPORTS',
  'KITCHEN',
  'GARDEN',
  'MONEY',
  'OTHER',
];

interface ItemFormProps {
  mode?: 'create' | 'edit';
  defaultValues?: Partial<CreateItemDto>;
  onSubmit: (data: CreateItemDto) => void;
  isLoading: boolean;
  error?: string;
  submitLabel: string;
}

export function ItemForm({
  mode = 'create',
  defaultValues,
  onSubmit,
  isLoading,
  error,
  submitLabel,
}: ItemFormProps) {
  const { t } = useTranslation();
  const isCreate = mode === 'create';
  const {
    control,
    handleSubmit,
    setFocus,
    watch,
    formState: { errors },
  } = useForm<CreateItemDto>({
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      category: defaultValues?.category ?? ('' as ItemCategory),
      estimatedValue: defaultValues?.estimatedValue ?? undefined,
    },
  });

  const selectedCategory = watch('category');

  const submitForm = handleSubmit(onSubmit);
  // The return key of the last field submits like the button, never while it is disabled.
  const submitFromKeyboard = () => {
    if (!isLoading) void submitForm();
  };

  return (
    <View style={styles.container}>
      <Controller
        control={control}
        name="name"
        rules={{
          ...(isCreate && { required: t('items.nameRequired') }),
          minLength: { value: 3, message: t('items.nameMinLength') },
          maxLength: { value: 100, message: t('items.nameMaxLength') },
        }}
        render={({ field: { onChange, onBlur, value, ref } }) => (
          <TextInput
            label={t('items.name')}
            mode="outlined"
            left={<TextInput.Icon icon="tag-outline" color="#A8B5BF" />}
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={!!errors.name}
            ref={ref}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => setFocus('description')}
            testID="name-input"
            style={[styles.input, ui.input]}
            outlineStyle={styles.outline}
          />
        )}
      />
      {errors.name && (
        <HelperText type="error" testID="name-error">
          {errors.name.message}
        </HelperText>
      )}

      <Controller
        control={control}
        name="description"
        rules={{
          maxLength: { value: 500, message: t('items.descriptionMaxLength') },
        }}
        render={({ field: { onChange, onBlur, value, ref } }) => (
          <TextInput
            label={t('items.description')}
            mode="outlined"
            multiline
            numberOfLines={3}
            left={<TextInput.Icon icon="text-box-outline" color="#A8B5BF" />}
            onBlur={onBlur}
            onChangeText={onChange}
            value={value ?? ''}
            error={!!errors.description}
            ref={ref}
            testID="description-input"
            style={[styles.input, ui.input]}
            outlineStyle={styles.outline}
            contentStyle={{ textAlignVertical: 'top' }}
          />
        )}
      />
      {errors.description && (
        <HelperText type="error" testID="description-error">
          {errors.description.message}
        </HelperText>
      )}

      <Text variant="labelLarge" style={styles.categoryLabel}>
        {t('items.category')}
      </Text>
      <Controller
        control={control}
        name="category"
        rules={{
          required: t('items.categoryRequired'),
        }}
        render={({ field: { onChange, value } }) => (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            <View style={styles.chipRow}>
              {CATEGORIES.map((cat) => (
                <Chip
                  key={cat}
                  selected={value === cat}
                  onPress={() => onChange(cat)}
                  style={[styles.chip, value === cat && styles.chipSelected]}
                  textStyle={value === cat ? styles.chipTextSelected : undefined}
                  testID={`category-chip-${cat}`}
                >
                  {t(CATEGORY_I18N[cat])}
                </Chip>
              ))}
            </View>
          </ScrollView>
        )}
      />
      {errors.category && (
        <HelperText type="error" testID="category-error">
          {errors.category.message}
        </HelperText>
      )}

      <Controller
        control={control}
        name="estimatedValue"
        rules={{
          ...(selectedCategory === 'MONEY' && {
            required: t('items.estimatedValueRequired'),
          }),
          min: { value: 0, message: t('items.estimatedValueMin') },
        }}
        render={({ field: { onChange, onBlur, value, ref } }) => (
          <DecimalInput
            label={t('items.estimatedValue')}
            onBlur={onBlur}
            onChange={onChange}
            value={value ?? undefined}
            error={!!errors.estimatedValue}
            ref={ref}
            returnKeyType="done"
            onSubmitEditing={submitFromKeyboard}
            testID="estimatedValue-input"
            style={[styles.input, ui.input]}
            outlineStyle={styles.outline}
          />
        )}
      />
      {errors.estimatedValue && (
        <HelperText type="error" testID="estimatedValue-error">
          {errors.estimatedValue.message}
        </HelperText>
      )}

      {error && (
        <HelperText type="error" testID="form-error">
          {error}
        </HelperText>
      )}

      <Button
        mode="contained"
        icon="content-save-outline"
        onPress={submitForm}
        loading={isLoading}
        disabled={isLoading}
        testID="item-submit-btn"
        style={styles.button}
        labelStyle={styles.buttonLabel}
        contentStyle={styles.buttonContent}
      >
        {submitLabel}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  input: { marginBottom: 8 },
  outline: { borderRadius: 12 },
  categoryLabel: { color: '#2D3748', marginTop: 8, marginBottom: 8 },
  chipScroll: { marginBottom: 8 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { backgroundColor: '#EDE9E2' },
  chipSelected: { backgroundColor: '#D0E4DB' },
  chipTextSelected: { color: '#4A6355', fontWeight: '600' },
  button: { marginTop: 20, borderRadius: 12 },
  buttonLabel: { fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  buttonContent: { paddingVertical: 8, flexDirection: 'row-reverse' },
});
