import { Button, Group, PasswordInput, SegmentedControl, Stack, Text, ThemeIcon } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { IconCertificate, IconFileCheck, IconUpload, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { api, ApiError } from "../../api";
import { ErrorBox } from "../../components/ui";
import { useI18n } from "../../i18n";
import { bytesToBase64 } from "../../lib/files";
import type { Environment, Session } from "../../types";

type Choice = "auto" | Environment;

const ACCEPT = { "application/x-pkcs12": [".p12", ".pfx"], "application/x-pem-file": [".pem"] };

/**
 * Upload of a .p12/.pfx certificate. The file goes only to the local server, which keeps it
 * in memory and checks it with CIS; the password is needed only when the file has one.
 */
export function SetupForm({ onLoaded }: { onLoaded: (session: Session) => void }) {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [environment, setEnvironment] = useState<Choice>("auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit() {
    if (!file) {
      setError(new ApiError(400, { message: t("setup.noFile") }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await api<Session>("/api/session", {
        certificate: bytesToBase64(await file.arrayBuffer()),
        password,
        environment: environment === "auto" ? null : environment,
        fileName: file.name,
      });
      setFile(null);
      setPassword("");
      onLoaded(session);
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Stack gap="md">
        <Dropzone
          onDrop={(files) => {
            setFile(files[0] ?? null);
            setError(null);
          }}
          accept={ACCEPT}
          multiple={false}
          radius="lg"
          p="lg"
        >
          <Group justify="center" gap="md" wrap="nowrap" mih={92} style={{ pointerEvents: "none" }}>
            <Dropzone.Accept>
              <ThemeIcon size={48} radius="xl" variant="light" color="indigo">
                <IconUpload size={24} />
              </ThemeIcon>
            </Dropzone.Accept>
            <Dropzone.Reject>
              <ThemeIcon size={48} radius="xl" variant="light" color="red">
                <IconX size={24} />
              </ThemeIcon>
            </Dropzone.Reject>
            <Dropzone.Idle>
              <ThemeIcon size={48} radius="xl" variant="light" color={file ? "teal" : "gray"}>
                {file ? <IconFileCheck size={24} /> : <IconCertificate size={24} />}
              </ThemeIcon>
            </Dropzone.Idle>
            <div>
              <Text fw={600} style={{ overflowWrap: "anywhere" }}>
                {file ? file.name : t("setup.drop")}
              </Text>
              <Text size="sm" c="dimmed">
                {file
                  ? `${Math.max(1, Math.round(file.size / 1024))} KB · ${t("setup.change")}`
                  : ".p12 · .pfx · .pem"}
              </Text>
            </div>
          </Group>
        </Dropzone>
        <PasswordInput
          label={t("setup.password")}
          value={password}
          autoComplete="off"
          onChange={(event) => setPassword(event.currentTarget.value)}
        />
        <Stack gap={6}>
          <Text size="sm" fw={500}>
            {t("setup.environment")}
          </Text>
          <SegmentedControl
            fullWidth
            value={environment}
            onChange={(value) => setEnvironment(value)}
            data={(["auto", "production", "test"] as const).map((value) => ({
              value,
              label: t(`env.${value}`),
            }))}
          />
        </Stack>
        <Button type="submit" size="md" loading={busy}>
          {t("setup.load")}
        </Button>
        {busy && (
          <Text size="sm" c="dimmed" ta="center">
            {t("setup.loading")}
          </Text>
        )}
        {error !== null && <ErrorBox error={error} />}
      </Stack>
    </form>
  );
}
