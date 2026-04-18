-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "auth_provider" TEXT NOT NULL DEFAULT 'supabase',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_credentials" (
    "id" TEXT NOT NULL,
    "app_key_encrypted" BYTEA NOT NULL,
    "app_secret_encrypted" BYTEA NOT NULL,
    "access_token_encrypted" BYTEA NOT NULL,
    "encryption_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'temu',
    "platform_shop_id" TEXT NOT NULL,
    "shop_type" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "display_name" TEXT,
    "creds_vault_ref" TEXT NOT NULL,
    "access_token_expires_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "member_user_id_org_id_key" ON "member"("user_id", "org_id");

-- CreateIndex
CREATE INDEX "member_org_id_idx" ON "member"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "shop_creds_vault_ref_key" ON "shop"("creds_vault_ref");

-- CreateIndex
CREATE UNIQUE INDEX "shop_org_id_platform_platform_shop_id_key" ON "shop"("org_id", "platform", "platform_shop_id");

-- CreateIndex
CREATE INDEX "shop_org_id_platform_idx" ON "shop"("org_id", "platform");

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop" ADD CONSTRAINT "shop_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop" ADD CONSTRAINT "shop_creds_vault_ref_fkey" FOREIGN KEY ("creds_vault_ref") REFERENCES "shop_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
