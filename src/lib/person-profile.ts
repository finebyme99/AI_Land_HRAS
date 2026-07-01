export interface PersonProfile {
  name: string;
  enName?: string;
  openId?: string;
  userId?: string;
  unionId?: string;
  email?: string;
  avatarUrl?: string;
  employeeId?: string;
  department?: string;
  jobTitle?: string;
}

export type PersonProfileDetails = Partial<Omit<PersonProfile, 'name' | 'openId'>>;

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function cleanProfile(profile: PersonProfile): PersonProfile {
  return Object.fromEntries(
    Object.entries(profile).filter(([, value]) => value !== undefined && value !== ''),
  ) as PersonProfile;
}

export function normalizeBitablePersonProfiles(value: unknown): PersonProfile[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values
    .map((item) => {
      if (typeof item === 'string') {
        const name = cleanString(item);
        return name ? { name } : null;
      }
      if (!item || typeof item !== 'object') return null;

      const record = item as Record<string, unknown>;
      const name = cleanString(record.name) ?? cleanString(record.en_name) ?? cleanString(record.id);
      if (!name) return null;

      return cleanProfile({
        name,
        enName: cleanString(record.en_name),
        openId: cleanString(record.open_id) ?? cleanString(record.id),
        userId: cleanString(record.user_id),
        unionId: cleanString(record.union_id),
        email: cleanString(record.email) ?? cleanString(record.enterprise_email),
        avatarUrl: cleanString(record.avatar_url),
      });
    })
    .filter((profile): profile is PersonProfile => profile !== null);
}

export function profilesFromNames(values: string[] | string | null | undefined): PersonProfile[] {
  const names = Array.isArray(values) ? values : values ? [values] : [];
  return names
    .map((name) => cleanString(name))
    .filter((name): name is string => Boolean(name))
    .map((name) => ({ name }));
}

export function mergePersonProfileDetails(
  profiles: PersonProfile[],
  feishuDetailsByOpenId: Map<string, PersonProfileDetails>,
  localDetailsByOpenId: Map<string, PersonProfileDetails>,
): PersonProfile[] {
  return profiles.map((profile) => {
    const feishuDetails = profile.openId ? feishuDetailsByOpenId.get(profile.openId) : undefined;
    const localDetails = profile.openId ? localDetailsByOpenId.get(profile.openId) : undefined;

    return cleanProfile({
      ...profile,
      ...feishuDetails,
      employeeId: feishuDetails?.employeeId ?? localDetails?.employeeId ?? profile.employeeId,
      department: localDetails?.department ?? feishuDetails?.department ?? profile.department,
      email: feishuDetails?.email ?? profile.email,
      avatarUrl: feishuDetails?.avatarUrl ?? profile.avatarUrl,
    });
  });
}

export function buildFeishuChatUrl(openId: string | null | undefined): string | null {
  const normalized = cleanString(openId);
  if (!normalized) return null;
  return `https://applink.feishu.cn/client/chat/open?openId=${encodeURIComponent(normalized)}`;
}
