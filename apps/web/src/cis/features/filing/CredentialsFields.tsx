import { Checkbox, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { useI18n } from "../../i18n";

export interface FilingCredentials {
  username: string;
  password: string;
  remember: boolean;
  passphrase: string;
}

export const emptyCredentials = (): FilingCredentials => ({
  username: "",
  password: "",
  remember: false,
  passphrase: "",
});

export function CredentialsFields({
  value,
  onChange,
  disabled = false,
}: {
  value: FilingCredentials;
  onChange: (next: FilingCredentials) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        {t("filing.credentialsHelp")}
      </Text>
      <TextInput
        label={t("filing.username")}
        value={value.username}
        autoComplete="off"
        disabled={disabled}
        required
        minLength={10}
        maxLength={10}
        pattern="[A-Za-z][0-9]{8}[A-Za-z]"
        onChange={(event) => onChange({ ...value, username: event.currentTarget.value.trim().toUpperCase() })}
      />
      <PasswordInput
        label={t("filing.password")}
        value={value.password}
        autoComplete="new-password"
        disabled={disabled}
        required
        onChange={(event) => onChange({ ...value, password: event.currentTarget.value })}
      />
      <Checkbox
        label={t("filing.remember")}
        description={t("filing.rememberHelp")}
        checked={value.remember}
        disabled={disabled}
        onChange={(event) => onChange({ ...value, remember: event.currentTarget.checked, passphrase: "" })}
      />
      {value.remember && (
        <PasswordInput
          label={t("filing.passphrase")}
          description={t("filing.passphraseHelp")}
          value={value.passphrase}
          autoComplete="new-password"
          minLength={12}
          required
          disabled={disabled}
          onChange={(event) => onChange({ ...value, passphrase: event.currentTarget.value })}
        />
      )}
    </Stack>
  );
}
