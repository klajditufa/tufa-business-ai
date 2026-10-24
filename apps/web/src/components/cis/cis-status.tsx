"use client";

import { useState } from "react";
import { Badge, Button, Group, Menu, PasswordInput, Text, UnstyledButton } from "@mantine/core";
import { IconCertificate, IconChevronDown, IconKey, IconLockOpen, IconTrash } from "@tabler/icons-react";
import { useCis } from "./cis-provider";

const dmy = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");

/** Statusi i certifikatës dhe i e-Albania pranë NIPT-it (si "Certifikata CIS u shtua" te cis-client). */
export function CisStatus() {
  const { certificate, ready, openDialog, remove, filing, unlockFiling, forgetFiling } = useCis();
  const [passphrase, setPassphrase] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  if (!ready) return null;

  const unlock = async () => {
    setUnlocking(true);
    setUnlockError(null);
    try {
      await unlockFiling(passphrase);
      setPassphrase("");
    } catch (e) {
      setUnlockError((e as Error).message);
    } finally {
      setUnlocking(false);
    }
  };

  const info = certificate?.info;
  return (
    <Menu width={320} position="bottom-end" closeOnItemClick>
      <Menu.Target>
        <UnstyledButton aria-label="Certifikata CIS dhe e-Albania">
          <Group gap={6} wrap="nowrap">
            {info ? (
              <Badge variant="light" color={info.environment === "test" ? "yellow" : "teal"}>
                {info.environment === "test" ? "Certifikatë testi CIS" : "Certifikata CIS u shtua"}
              </Badge>
            ) : (
              <Badge variant="light" color="gray">
                Mungon certifikata CIS
              </Badge>
            )}
            {(filing.configured || filing.remembered) && (
              <Badge variant="light" color={filing.configured ? "teal" : "gray"} leftSection={<IconKey size={11} />} rightSection={<IconChevronDown size={12} />}>
                e-Albania
              </Badge>
            )}
            {!filing.configured && !filing.remembered && <IconChevronDown size={14} />}
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Certifikata e fiskalizimit</Menu.Label>
        {info ? (
          <div className="px-3 pb-2">
            <Text size="sm" fw={600}>
              {info.name ?? info.commonName}
            </Text>
            <Text size="xs" c="dimmed">
              {info.nipt} · {info.environment === "test" ? "mjedisi i testit" : "prodhim"} · e vlefshme deri më {dmy(info.validTo)}
            </Text>
            <Text size="xs" c="dimmed">
              {certificate.persisted ? "Ruhet në këtë shfletues" : "Vetëm për këtë skedë"}
            </Text>
          </div>
        ) : (
          <Text size="xs" c="dimmed" px="sm" pb="xs">
            Për faturat, artikujt dhe regjistrat CIS nevojitet certifikata e fiskalizimit.
          </Text>
        )}
        <Menu.Item leftSection={<IconCertificate size={16} />} onClick={() => openDialog("certificate")}>
          {info ? "Zëvendëso certifikatën" : "Shto certifikatën"}
        </Menu.Item>
        {info && (
          <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={() => void remove()}>
            Hiqe nga ky shfletues
          </Menu.Item>
        )}
        <Menu.Divider />
        <Menu.Label>e-Albania (e-Filing)</Menu.Label>
        <Text size="xs" c="dimmed" px="sm" pb="xs">
          {filing.configured
            ? `Të dhënat e hyrjes janë të gatshme për këtë sesion · ${filing.username}`
            : filing.remembered
              ? "Të dhënat e hyrjes janë ruajtur të enkriptuara. Zhbllokojini me fjalëkalimin e kasafortës."
              : "Pa të dhëna të e-Albania."}
        </Text>
        {!filing.configured && filing.remembered && (
          <form
            className="px-3 pb-2"
            onSubmit={(e) => {
              e.preventDefault();
              void unlock();
            }}
          >
            <PasswordInput
              size="xs"
              placeholder="Fjalëkalimi i kasafortës"
              value={passphrase}
              error={unlockError}
              autoComplete="off"
              onChange={(e) => setPassphrase(e.currentTarget.value)}
            />
            <Button type="submit" size="compact-xs" mt={6} fullWidth loading={unlocking} leftSection={<IconLockOpen size={12} />}>
              Zhblloko të dhënat e ruajtura
            </Button>
          </form>
        )}
        <Menu.Item leftSection={<IconKey size={16} />} onClick={() => openDialog("filing")}>
          {filing.configured || filing.remembered ? "Hap e-Filing" : "Shto të dhënat e e-Albania (e-Filing)"}
        </Menu.Item>
        {(filing.configured || filing.remembered) && (
          <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={() => void forgetFiling()}>
            Harro të dhënat e e-Albania
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

/** "Shto certifikatën për këtë subjekt" pranë NIPT-it kur subjekti nuk ka certifikatë (si Workspace i cis-client). */
export function CisAddCertificate() {
  const { certificate, ready, openDialog } = useCis();
  if (!ready || certificate) return null;
  return (
    <Button size="xs" variant="default" leftSection={<IconCertificate size={16} />} onClick={() => openDialog()}>
      Shto certifikatën për këtë subjekt
    </Button>
  );
}
