/**
 * Tahawash — local development seed.
 *
 * Idempotent: safe to run multiple times. Uses upsert by stable unique keys
 * (super-admin username, tenant voen, customer phone) so re-running won't
 * create duplicates.
 *
 * Seeds:
 *  - 1 super-admin (login: admin / password: tahawash-dev-2026)
 *  - 1 tenant "YuBox" (active subscription) + tenant user (yubox / yubox-dev-2026)
 *  - 3 more demo tenants (Şəlalə, AquaJet, Polad Auto Spa) — full profiles,
 *    logos, photos, locations, bays, services, featured + demo transactions
 *  - 1 location "YuBox · Bakı 28 May" with 4 bays
 *  - 5 service displays (foam / pressure / wax / brush / vacuum)
 *  - 2 customers (Elvin and Aysel) with phone numbers + saved cards
 *  - A few transactions (paid + 1 hardware error)
 *  - 1 active promo card
 *  - Featured carwash entry for YuBox
 *  - App version row for iOS + Android
 *
 * Run: pnpm --filter @tahawash/backend prisma:seed
 */

import { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding Tahawash dev database...');

  // ── Super-admin ──────────────────────────────────────────────
  const superAdmin = await prisma.superAdminUser.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@tahawash.az',
      passwordHash: await bcrypt.hash('tahawash-dev-2026', 10),
      fullName: 'Tahawash Super Admin',
    },
  });
  console.log(`  ✓ Super-admin: ${superAdmin.username}`);

  // ── Tenant: YuBox ────────────────────────────────────────────
  const now = new Date();
  const subscriptionEnd = new Date(now);
  subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 3);

  const yubox = await prisma.tenant.upsert({
    where: { voen: '1234567891' },
    update: {},
    create: {
      brandName: 'YuBox',
      legalName: 'MMC YuBox',
      voen: '1234567891',
      ownerName: 'Rustam Akbarli',
      ownerEmail: 'owner@yubox.az',
      ownerPhone: '+994501234567',
      themeColor: '#0E7AE7',
      contactPhone: '+994 12 555 88 44',
      descriptionAz:
        'YuBox 24/7 self-servis avtoyuma məntəqəsi. 4 boks, köpük, təzyiqli su, fırça və vakuum stansiyaları.',
      descriptionRu:
        'YuBox — мойка самообслуживания 24/7. 4 бокса, пена, мойка под давлением, щётка, пылесос.',
      descriptionEn:
        'YuBox 24/7 self-service car wash. 4 bays with foam, pressure wash, brush and vacuum stations.',
      minChargeAmount: '1.00',
      chargeStep: '0.50',
      status: 'active',
      subscriptionStart: now,
      subscriptionEnd,
    },
  });
  console.log(`  ✓ Tenant: ${yubox.brandName} (status=${yubox.status})`);

  await prisma.tenantUser.upsert({
    where: { username: 'yubox' },
    update: {},
    create: {
      tenantId: yubox.id,
      username: 'yubox',
      passwordHash: await bcrypt.hash('yubox-dev-2026', 10),
    },
  });
  console.log(`  ✓ Tenant user: yubox (linked to YuBox)`);

  // Service displays
  const services = [
    { iconKey: 'foam', labelAz: 'Köpük', labelRu: 'Пена', labelEn: 'Foam' },
    { iconKey: 'pressure', labelAz: 'Təzyiq', labelRu: 'Давление', labelEn: 'Pressure' },
    { iconKey: 'wax', labelAz: 'Vax', labelRu: 'Воск', labelEn: 'Wax' },
    { iconKey: 'brush', labelAz: 'Fırça', labelRu: 'Щётка', labelEn: 'Brush' },
    { iconKey: 'vacuum', labelAz: 'Vakuum', labelRu: 'Пылесос', labelEn: 'Vacuum' },
  ];
  await prisma.serviceDisplay.deleteMany({ where: { tenantId: yubox.id } });
  for (const [i, svc] of services.entries()) {
    await prisma.serviceDisplay.create({
      data: { tenantId: yubox.id, sortOrder: i, ...svc },
    });
  }
  console.log(`  ✓ Service displays: ${services.length}`);

  // ── Location: YuBox · Bakı 28 May ────────────────────────────
  // 28 May metro station, Bakı, Azerbaijan: approx 40.3796° N, 49.8485° E
  //
  // Find-or-create approach (true idempotency): if a location with this
  // name already exists for this tenant, reuse it. Otherwise create.
  // We can't use plain `deleteMany` then `create` because bays + transactions
  // reference locations via FK — deletion would fail (P2003) once the
  // first seed has populated children.
  const existingLocation = await prisma.location.findFirst({
    where: { tenantId: yubox.id, name: 'YuBox · Bakı 28 May' },
  });
  const location =
    existingLocation ??
    (await prisma.location.create({
      data: {
        tenantId: yubox.id,
        name: 'YuBox · Bakı 28 May',
        address: '28 May küç., Nəsimi r-nu, Bakı',
        latitude: 40.3796,
        longitude: 49.8485,
        contactPhone: '+994 12 555 88 44',
        is24_7: true,
        status: 'active',
      },
    }));
  console.log(`  ✓ Location: ${location.name}${existingLocation ? ' (existing)' : ' (created)'}`);

  // ── 4 bays under that location ───────────────────────────────
  // Bays are keyed by the unique `qrShortId`. Upsert keeps them idempotent
  // and preserves any transactions that reference them.
  const bayIds = ['9KX42P', '7HM91L', '3PR58Q', '4BV22N'];
  const bays = await Promise.all(
    bayIds.map((qrShortId, i) =>
      prisma.bay.upsert({
        where: { qrShortId },
        update: {
          locationId: location.id,
          tenantId: yubox.id,
          name: `Bay ${i + 1}`,
          status: i === 3 ? 'disabled' : 'active',
        },
        create: {
          locationId: location.id,
          tenantId: yubox.id,
          name: `Bay ${i + 1}`,
          qrShortId,
          status: i === 3 ? 'disabled' : 'active',
        },
      }),
    ),
  );
  console.log(`  ✓ Bays: ${bays.length} (Bay 4 disabled for testing)`);

  // ── Customers ────────────────────────────────────────────────
  const elvin = await prisma.customer.upsert({
    where: { phone: '+994501234567' },
    update: {},
    create: {
      phone: '+994501234567',
      name: 'Elvin Məmmədov',
      language: 'az',
      city: 'Bakı',
    },
  });
  const aysel = await prisma.customer.upsert({
    where: { phone: '+994559876543' },
    update: {},
    create: {
      phone: '+994559876543',
      name: 'Aysel Hüseynova',
      language: 'ru',
      city: 'Bakı',
    },
  });
  console.log(`  ✓ Customers: ${elvin.name}, ${aysel.name}`);

  // Saved card for Elvin
  await prisma.savedCard.upsert({
    where: { ePointToken: 'epoint_token_dev_elvin_visa_4242' },
    update: {},
    create: {
      customerId: elvin.id,
      ePointToken: 'epoint_token_dev_elvin_visa_4242',
      brand: 'visa',
      lastFour: '4242',
      isDefault: true,
    },
  });

  // Favorite YuBox
  await prisma.favorite.upsert({
    where: { customerId_tenantId: { customerId: elvin.id, tenantId: yubox.id } },
    update: {},
    create: { customerId: elvin.id, tenantId: yubox.id },
  });
  console.log(`  ✓ Saved card + favorite for Elvin`);

  // ── Sample transactions ──────────────────────────────────────
  await prisma.transaction.deleteMany({
    where: { customerId: { in: [elvin.id, aysel.id] } },
  });

  // 3 successful transactions
  const txTimes = [
    { hoursAgo: 1, amount: '2.50', customer: elvin, bay: bays[2] },
    { hoursAgo: 6, amount: '1.50', customer: elvin, bay: bays[0] },
    { hoursAgo: 26, amount: '3.00', customer: aysel, bay: bays[1] },
  ] as const;

  for (const t of txTimes) {
    const created = new Date(now);
    created.setHours(created.getHours() - t.hoursAgo);
    await prisma.transaction.create({
      data: {
        customerId: t.customer.id,
        bayId: t.bay.id,
        locationId: location.id,
        tenantId: yubox.id,
        amountAzn: t.amount,
        status: 'paid_credited',
        paymentMethod: 'card',
        cardBrand: 'visa',
        cardLastFour: '4242',
        ePointReference: `dev_ref_${Math.random().toString(36).slice(2, 10)}`,
        hardwareCreditedAt: created,
        createdAt: created,
      },
    });
  }

  // 1 hardware error transaction (for testing the error state UI)
  const errorCreated = new Date(now);
  errorCreated.setHours(errorCreated.getHours() - 30);
  await prisma.transaction.create({
    data: {
      customerId: aysel.id,
      bayId: bays[1]!.id,
      locationId: location.id,
      tenantId: yubox.id,
      amountAzn: '1.00',
      status: 'paid_hardware_error',
      paymentMethod: 'card',
      cardBrand: 'mastercard',
      cardLastFour: '0089',
      ePointReference: `dev_ref_${Math.random().toString(36).slice(2, 10)}`,
      errorReason: 'Hardware ACK timeout after 30s',
      createdAt: errorCreated,
    },
  });
  console.log(`  ✓ Transactions: 3 paid + 1 hardware error`);

  // ── Featured carwash ─────────────────────────────────────────
  await prisma.featuredTenant.upsert({
    where: { tenantId: yubox.id },
    update: {},
    create: { tenantId: yubox.id, sortOrder: 0 },
  });
  console.log(`  ✓ Featured: YuBox`);

  // ── Active promos (Main-tab carousel) ────────────────────────
  // Three image-less banners, each a different color theme, so the
  // multi-banner carousel + per-promo color picker can be seen end-to-end.
  const promoEnd = new Date(now);
  promoEnd.setMonth(promoEnd.getMonth() + 1);
  const promoTitles = ['First wash on us.', 'Weekend shine.', 'Bring a friend.'];
  await prisma.promo.deleteMany({ where: { titleEn: { in: promoTitles } } });
  await prisma.promo.createMany({
    data: [
      {
        imageUrl: null,
        theme: 'blue',
        titleAz: 'İlk yumanız bizdən.',
        titleRu: 'Первая мойка за наш счёт.',
        titleEn: 'First wash on us.',
        bodyAz: 'YuBox boksunda ilk yumanız üçün 2,00 ₼ endirim.',
        bodyRu: 'Скидка 2,00 ₼ на первую мойку в YuBox.',
        bodyEn: 'Get 2,00 ₼ off your first wash at any YuBox bay.',
        ctaTextAz: 'Tələb et',
        ctaTextRu: 'Получить',
        ctaTextEn: 'Claim offer',
        ctaTargetType: 'tenant',
        ctaTargetValue: yubox.id,
        startAt: now,
        endAt: promoEnd,
        status: 'active',
      },
      {
        imageUrl: null,
        theme: 'violet',
        titleAz: 'Həftəsonu parıltısı.',
        titleRu: 'Блеск на выходных.',
        titleEn: 'Weekend shine.',
        bodyAz: 'Şənbə-bazar köpük + mum yumalarında bonus dəqiqələr.',
        bodyRu: 'Бонусные минуты на мойках с пеной и воском по выходным.',
        bodyEn: 'Bonus minutes on foam + wax washes every weekend.',
        ctaTextAz: 'Yaxınlığı tap',
        ctaTextRu: 'Найти рядом',
        ctaTextEn: 'Find a bay',
        ctaTargetType: 'tenant',
        ctaTargetValue: yubox.id,
        startAt: now,
        endAt: promoEnd,
        status: 'active',
      },
      {
        imageUrl: null,
        theme: 'teal',
        titleAz: 'Dostunu gətir.',
        titleRu: 'Приведи друга.',
        titleEn: 'Bring a friend.',
        bodyAz: 'Dostunu dəvət et — hər ikiniz növbəti yumada endirim qazanın.',
        bodyRu: 'Пригласи друга — оба получите скидку на следующую мойку.',
        bodyEn: 'Invite a friend — you both get money off your next wash.',
        ctaTextAz: 'Dəvət et',
        ctaTextRu: 'Пригласить',
        ctaTextEn: 'Invite',
        ctaTargetType: null,
        ctaTargetValue: null,
        startAt: now,
        endAt: promoEnd,
        status: 'active',
      },
    ],
  });
  console.log(`  ✓ Active promos: ${promoTitles.join(', ')}`);

  // ── App version targets ──────────────────────────────────────
  await prisma.appVersion.upsert({
    where: { platform: 'ios' },
    update: { latestVersion: '0.1.0', minimumVersion: '0.1.0' },
    create: { platform: 'ios', latestVersion: '0.1.0', minimumVersion: '0.1.0' },
  });
  await prisma.appVersion.upsert({
    where: { platform: 'android' },
    update: { latestVersion: '0.1.0', minimumVersion: '0.1.0' },
    create: { platform: 'android', latestVersion: '0.1.0', minimumVersion: '0.1.0' },
  });
  console.log(`  ✓ App versions: iOS + Android both 0.1.0`);

  // ────────────────────────────────────────────────────────────
  // Additional demo tenants — brings the platform to 4 carwashes total
  // (YuBox + 3) so the map, featured strip, search and super-admin lists
  // feel like a real, populated platform.
  //
  // FULLY IDEMPOTENT & PROD-SAFE: tenants upsert by voen, users by username,
  // bays by qrShortId. Per-tenant child rows (services, photos, demo
  // transactions, favorites) are cleared SCOPED TO THAT TENANT then
  // recreated — so re-running never duplicates and never touches YuBox or
  // any real customer/transaction data.
  // ────────────────────────────────────────────────────────────
  const SERVICE_CATALOG: Record<
    string,
    { iconKey: string; labelAz: string; labelRu: string; labelEn: string }
  > = {
    foam: { iconKey: 'foam', labelAz: 'Köpük', labelRu: 'Пена', labelEn: 'Foam' },
    pressure: { iconKey: 'pressure', labelAz: 'Təzyiq', labelRu: 'Давление', labelEn: 'Pressure' },
    wax: { iconKey: 'wax', labelAz: 'Vax', labelRu: 'Воск', labelEn: 'Wax' },
    brush: { iconKey: 'brush', labelAz: 'Fırça', labelRu: 'Щётка', labelEn: 'Brush' },
    vacuum: { iconKey: 'vacuum', labelAz: 'Vakuum', labelRu: 'Пылесос', labelEn: 'Vacuum' },
  };

  // Branded letter-mark logo (always loads, no upload needed). Real photos
  // can be swapped in later via the admin photo manager.
  const logoFor = (name: string, hex: string): string =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${hex.replace(
      '#',
      '',
    )}&color=ffffff&size=256&bold=true&format=png`;
  // Deterministic stock photo per seed (placeholder gallery imagery).
  const photoFor = (seed: string): string => `https://picsum.photos/seed/${seed}/1200/800`;
  const daysFromNow = (d: number): Date => {
    const dt = new Date(now);
    dt.setDate(dt.getDate() + d);
    return dt;
  };
  const week = (
    open: string,
    close: string,
    sun: { open: string; close: string },
  ): Record<string, { open: string; close: string }> => ({
    mon: { open, close },
    tue: { open, close },
    wed: { open, close },
    thu: { open, close },
    fri: { open, close },
    sat: { open, close },
    sun,
  });

  interface DemoTenant {
    brandName: string;
    avatarName: string; // ASCII name for the logo letter-mark
    legalName: string;
    voen: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string;
    ePointMerchantId: string;
    themeColor: string;
    contactPhone: string;
    minChargeAmount: string;
    chargeStep: string;
    username: string;
    password: string;
    subStart: Date;
    subEnd: Date;
    descriptionAz: string;
    descriptionRu: string;
    descriptionEn: string;
    services: string[];
    location: {
      name: string;
      address: string;
      latitude: number;
      longitude: number;
      is24_7: boolean;
      workingHours: Record<string, { open: string; close: string }> | null;
    };
    bays: Array<{ qr: string; status: 'active' | 'disabled' }>;
    featuredSort: number;
    favoriteBy?: 'elvin' | 'aysel';
  }

  const demoTenants: DemoTenant[] = [
    {
      brandName: 'Şəlalə Avtoyuma',
      avatarName: 'Shelale',
      legalName: 'MMC Şəlalə Servis',
      voen: '2345678902',
      ownerName: 'Kamran Əliyev',
      ownerEmail: 'kamran@shelale.az',
      ownerPhone: '+994552345678',
      ePointMerchantId: 'EP-SHL-1042',
      themeColor: '#0D9488',
      contactPhone: '+994 12 480 22 11',
      minChargeAmount: '1.00',
      chargeStep: '0.50',
      username: 'shelale',
      password: 'shelale-dev-2026',
      subStart: daysFromNow(-60),
      subEnd: daysFromNow(30),
      descriptionAz:
        'Şəlalə Avtoyuma — Yasamalda 24/7 self-servis məntəqəsi. Yumşaq köpük, yüksək təzyiqli su və mum stansiyaları.',
      descriptionRu:
        'Şəlalə — мойка самообслуживания 24/7 в Ясамале. Мягкая пена, мойка под высоким давлением и воск.',
      descriptionEn:
        'Şəlalə Car Wash — a 24/7 self-service station in Yasamal with soft foam, high-pressure rinse and wax.',
      services: ['foam', 'pressure', 'wax', 'vacuum'],
      location: {
        name: 'Şəlalə · Yasamal',
        address: 'Şərifzadə küç. 203, Yasamal r-nu, Bakı',
        latitude: 40.3905,
        longitude: 49.8042,
        is24_7: true,
        workingHours: null,
      },
      bays: [
        { qr: 'SHL4K2', status: 'active' },
        { qr: 'SHL9M7', status: 'active' },
        { qr: 'SHL3P8', status: 'active' },
      ],
      featuredSort: 1,
      favoriteBy: 'aysel',
    },
    {
      brandName: 'AquaJet',
      avatarName: 'AquaJet',
      legalName: 'MMC AquaJet Baku',
      voen: '3456789013',
      ownerName: 'Elnur Rzayev',
      ownerEmail: 'elnur@aquajet.az',
      ownerPhone: '+994703456789',
      ePointMerchantId: 'EP-AQJ-2087',
      themeColor: '#4F46E5',
      contactPhone: '+994 12 565 33 22',
      minChargeAmount: '1.00',
      chargeStep: '0.50',
      username: 'aquajet',
      password: 'aquajet-dev-2026',
      subStart: daysFromNow(-30),
      subEnd: daysFromNow(60),
      descriptionAz:
        'AquaJet — Xətai rayonunda müasir avtoyuma. 4 boks, güclü təzyiq, köpük, fırça və vakuum. Sürətli və etibarlı.',
      descriptionRu:
        'AquaJet — современная мойка в Хатаи. 4 бокса, мощное давление, пена, щётка и пылесос. Быстро и надёжно.',
      descriptionEn:
        'AquaJet — a modern car wash in Khatai. 4 bays with powerful pressure, foam, brush and vacuum.',
      services: ['foam', 'pressure', 'brush', 'vacuum'],
      location: {
        name: 'AquaJet · Xətai',
        address: 'Babək pr. 49, Xətai r-nu, Bakı',
        latitude: 40.3812,
        longitude: 49.8901,
        is24_7: false,
        workingHours: week('08:00', '23:00', { open: '09:00', close: '22:00' }),
      },
      bays: [
        { qr: 'AQJ7M2', status: 'active' },
        { qr: 'AQJ4K9', status: 'active' },
        { qr: 'AQJ3B5', status: 'active' },
        { qr: 'AQJ8H6', status: 'disabled' },
      ],
      featuredSort: 2,
      favoriteBy: 'elvin',
    },
    {
      brandName: 'Polad Auto Spa',
      avatarName: 'Polad',
      legalName: 'MMC Polad Auto',
      voen: '4567890124',
      ownerName: 'Tural Hüseynov',
      ownerEmail: 'tural@poladauto.az',
      ownerPhone: '+994513456780',
      ePointMerchantId: 'EP-PLD-3310',
      themeColor: '#D97706',
      contactPhone: '+994 12 510 77 33',
      minChargeAmount: '2.00',
      chargeStep: '1.00',
      username: 'polad',
      password: 'polad-dev-2026',
      subStart: daysFromNow(-90),
      subEnd: daysFromNow(120),
      descriptionAz:
        'Polad Auto Spa — Nərimanovda premium avtoyuma. Əl ilə köpükləmə, mum və detallı təmizlik. Avtomobiliniz üçün spa təcrübəsi.',
      descriptionRu:
        'Polad Auto Spa — премиальная мойка в Наримановском районе. Ручная пена, воск и детейлинг.',
      descriptionEn:
        'Polad Auto Spa — a premium wash in Narimanov. Hand foam, wax and detailing. A spa for your car.',
      services: ['foam', 'pressure', 'wax', 'brush', 'vacuum'],
      location: {
        name: 'Polad Auto Spa · Nərimanov',
        address: 'Atatürk pr. 32, Nərimanov r-nu, Bakı',
        latitude: 40.4061,
        longitude: 49.8668,
        is24_7: false,
        workingHours: week('09:00', '21:00', { open: '10:00', close: '18:00' }),
      },
      bays: [
        { qr: 'PLD5K2', status: 'active' },
        { qr: 'PLD9X7', status: 'active' },
        { qr: 'PLD3B4', status: 'active' },
      ],
      featuredSort: 3,
    },
  ];

  for (const cfg of demoTenants) {
    const tenantData = {
      brandName: cfg.brandName,
      legalName: cfg.legalName,
      ownerName: cfg.ownerName,
      ownerEmail: cfg.ownerEmail,
      ownerPhone: cfg.ownerPhone,
      ePointMerchantId: cfg.ePointMerchantId,
      themeColor: cfg.themeColor,
      logoUrl: logoFor(cfg.avatarName, cfg.themeColor),
      descriptionAz: cfg.descriptionAz,
      descriptionRu: cfg.descriptionRu,
      descriptionEn: cfg.descriptionEn,
      contactPhone: cfg.contactPhone,
      minChargeAmount: cfg.minChargeAmount,
      chargeStep: cfg.chargeStep,
      status: 'active' as const,
      subscriptionStart: cfg.subStart,
      subscriptionEnd: cfg.subEnd,
    };
    const tenant = await prisma.tenant.upsert({
      where: { voen: cfg.voen },
      update: tenantData,
      create: { voen: cfg.voen, ...tenantData },
    });

    await prisma.tenantUser.upsert({
      where: { username: cfg.username },
      update: {},
      create: {
        tenantId: tenant.id,
        username: cfg.username,
        passwordHash: await bcrypt.hash(cfg.password, 10),
      },
    });

    // Services (scoped reset → recreate)
    await prisma.serviceDisplay.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.serviceDisplay.createMany({
      data: cfg.services.map((key, i) => ({
        tenantId: tenant.id,
        sortOrder: i,
        ...SERVICE_CATALOG[key]!,
      })),
    });

    // Tenant gallery photos (scoped reset → recreate)
    await prisma.tenantPhoto.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenantPhoto.createMany({
      data: [
        { tenantId: tenant.id, url: photoFor(`${cfg.username}-hero`), sortOrder: 0, isHero: true },
        { tenantId: tenant.id, url: photoFor(`${cfg.username}-2`), sortOrder: 1, isHero: false },
      ],
    });

    // Location (find-or-create by name; update keeps it in sync on re-run)
    const locData = {
      address: cfg.location.address,
      latitude: cfg.location.latitude,
      longitude: cfg.location.longitude,
      contactPhone: cfg.contactPhone,
      is24_7: cfg.location.is24_7,
      workingHours: cfg.location.workingHours ?? Prisma.DbNull,
      status: 'active' as const,
    };
    const existingLoc = await prisma.location.findFirst({
      where: { tenantId: tenant.id, name: cfg.location.name },
    });
    const loc = existingLoc
      ? await prisma.location.update({ where: { id: existingLoc.id }, data: locData })
      : await prisma.location.create({
          data: { tenantId: tenant.id, name: cfg.location.name, ...locData },
        });

    // Location photos (scoped reset → recreate)
    await prisma.locationPhoto.deleteMany({ where: { locationId: loc.id } });
    await prisma.locationPhoto.createMany({
      data: [
        { locationId: loc.id, url: photoFor(`${cfg.username}-loc1`), sortOrder: 0, isHero: true },
        { locationId: loc.id, url: photoFor(`${cfg.username}-loc2`), sortOrder: 1, isHero: false },
      ],
    });

    // Bays (upsert by qrShortId — preserves any referencing transactions)
    const bays = await Promise.all(
      cfg.bays.map((b, i) =>
        prisma.bay.upsert({
          where: { qrShortId: b.qr },
          update: { locationId: loc.id, tenantId: tenant.id, name: `Bay ${i + 1}`, status: b.status },
          create: {
            locationId: loc.id,
            tenantId: tenant.id,
            name: `Bay ${i + 1}`,
            qrShortId: b.qr,
            status: b.status,
          },
        }),
      ),
    );

    // Featured carwash entry (so it shows on the Main-tab featured strip)
    await prisma.featuredTenant.upsert({
      where: { tenantId: tenant.id },
      update: { sortOrder: cfg.featuredSort },
      create: { tenantId: tenant.id, sortOrder: cfg.featuredSort },
    });

    // A couple of demo transactions so dashboards/financials aren't empty.
    // Scoped reset keeps this idempotent without touching other tenants.
    await prisma.transaction.deleteMany({
      where: { tenantId: tenant.id, customerId: { in: [elvin.id, aysel.id] } },
    });
    const activeBay = bays.find((b) => b.status === 'active') ?? bays[0]!;
    const demoTx = [
      { customer: elvin, amount: '2.50', hoursAgo: 4 },
      { customer: aysel, amount: '1.50', hoursAgo: 28 },
    ];
    for (const t of demoTx) {
      const created = new Date(now);
      created.setHours(created.getHours() - t.hoursAgo);
      await prisma.transaction.create({
        data: {
          customerId: t.customer.id,
          bayId: activeBay.id,
          locationId: loc.id,
          tenantId: tenant.id,
          amountAzn: t.amount,
          status: 'paid_credited',
          paymentMethod: 'card',
          cardBrand: 'visa',
          cardLastFour: '4242',
          ePointReference: `dev_ref_${Math.random().toString(36).slice(2, 10)}`,
          hardwareCreditedAt: created,
          createdAt: created,
        },
      });
    }

    // Favorite for variety on the customer's Main tab
    if (cfg.favoriteBy) {
      const fav = cfg.favoriteBy === 'elvin' ? elvin : aysel;
      await prisma.favorite.upsert({
        where: { customerId_tenantId: { customerId: fav.id, tenantId: tenant.id } },
        update: {},
        create: { customerId: fav.id, tenantId: tenant.id },
      });
    }

    console.log(
      `  ✓ Tenant: ${tenant.brandName} (login ${cfg.username}) — ` +
        `${cfg.bays.length} bays, ${cfg.services.length} services, featured #${cfg.featuredSort}`,
    );
  }

  console.log('🌱 Seed complete.');
  console.log('');
  console.log('Login credentials (dev only — never use these in production):');
  console.log('  Super-admin: admin / tahawash-dev-2026');
  console.log('  Tenant user: yubox / yubox-dev-2026');
  console.log('  Tenant user: shelale / shelale-dev-2026');
  console.log('  Tenant user: aquajet / aquajet-dev-2026');
  console.log('  Tenant user: polad / polad-dev-2026');
  console.log('  Customer:    +994501234567 (Elvin)');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
