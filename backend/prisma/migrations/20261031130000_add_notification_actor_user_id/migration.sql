-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "actor_user_id" UUID;

-- CreateIndex
CREATE INDEX "notifications_actor_user_id_idx" ON "notifications"("actor_user_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
