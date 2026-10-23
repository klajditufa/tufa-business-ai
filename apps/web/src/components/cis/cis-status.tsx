"use client";

import { Badge, Button, Menu, Text, UnstyledButton } from "@mantine/core";
import { IconCertificate, IconChevronDown, IconTrash } from "@tabler/icons-react";
import { useCis } from "./cis-provider";

const dmy = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");

/** Statusi i certifikatës pranë NIPT-it (si "Certifikata CIS u shtua" te cis-client). */
export function CisStatus() {
  const { certificate, ready, openDialog, remove } = useCis();
  if (!ready) return null;
  if (!certificate) {
    return (
      <Button size="compact-sm" variant="light" leftSection={<IconCertificate size={14} stroke={1.8} />} onClick={openDialog}>
        Shto certifikatën CIS
      </Button>
    );
  }
  const { info } = certificate;
  return (
    <Menu width={300} position="bottom-end">
      <Menu.Target>
        <UnstyledButton aria-label="Certifikata CIS">
          <Badge variant="light" color={info.environment === "test" ? "yellow" : "teal"} rightSection={<IconChevronDown size={12} />}>
            {info.environment === "test" ? "Certifikatë testi CIS" : "Certifikata CIS u shtua"}
          </Badge>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Certifikata e fiskalizimit</Menu.Label>
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
        <Menu.Divider />
        <Menu.Item leftSection={<IconCertificate size={16} />} onClick={openDialog}>
          Zëvendëso certifikatën
        </Menu.Item>
        <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={() => void remove()}>
          Hiqe nga ky shfletues
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
