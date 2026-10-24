"use client";

import { Checkbox, PasswordInput, Stack, Text, TextInput } from "@mantine/core";

/** Fushat e e-Albania (si CredentialsFields i cis-client-2). */
export type CredentialsValue = { username: string; password: string; remember: boolean; passphrase: string };

export const emptyCredentials = (username = ""): CredentialsValue => ({ username, password: "", remember: false, passphrase: "" });

export function CredentialsFields({
  value,
  onChange,
  disabled = false,
}: {
  value: CredentialsValue;
  onChange: (next: CredentialsValue) => void;
  disabled?: boolean;
}) {
  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Përdorni NUIS-in dhe fjalëkalimin e e-Albania të subjektit. TUFA hyn automatikisht në e-Filing përmes e-Albania (me shtesën e Chrome). Faturat
        merren me certifikatën e fiskalizimit.
      </Text>
      <TextInput
        label="NUIS / NIPT i e-Albania"
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
        label="Fjalëkalimi i e-Albania"
        value={value.password}
        autoComplete="new-password"
        disabled={disabled}
        required
        onChange={(event) => onChange({ ...value, password: event.currentTarget.value })}
      />
      <Checkbox
        label="Ruaji të enkriptuara në këtë kompjuter"
        description="Pa këtë zgjedhje, të dhënat përdoren vetëm për këtë sesion. Përdorni “Harro” për t'i fshirë."
        checked={value.remember}
        disabled={disabled}
        onChange={(event) => onChange({ ...value, remember: event.currentTarget.checked, passphrase: "" })}
      />
      {value.remember && (
        <PasswordInput
          label="Fjalëkalimi i kasafortës"
          description="Të paktën 12 karaktere. Kërkohet pas rifreskimit të faqes; mbajeni të ndarë nga fjalëkalimi i portalit."
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
