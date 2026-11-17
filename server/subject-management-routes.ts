import { previewMasterClassConfiguration } from "./master-subject-configuration";
import type { Express, RequestHandler } from "express";
import { auditSubjectManagement } from "./subject-management-audit";
import { previewSubjectMerge } from "./subject-merge-preview";
import { checkSubjectMergeRecovery } from "./subject-merge-resolution";
import { z } from "zod";

export function registerSubjectManagementRoutes(app: Express, authenticate: RequestHandler, requireMainAdmin: RequestHandler) {
  const prefix = "/api/admin/subject-management";
  app.get(prefix+"/audit", authenticate, requireMainAdmin, async (_req,res) => {
    try {
      res.setHeader("Cache-Control","no-store");
      res.json(await auditSubjectManagement());
    } catch (e) {
      console.error("Subject audit failed",e);
      res.status(500).json({error:"Subject audit failed"});
    }
  });
  app.post(prefix+"/preview", authenticate, requireMainAdmin, async (req,res) => {
    const parsed = z.object({sourceId:z.string().uuid(),targetId:z.string().uuid()}).safeParse(req.body);
    if (!parsed.success || parsed.data.sourceId.toLowerCase()===parsed.data.targetId.toLowerCase()) {
      return res.status(400).json({error:"Select two different subjects"});
    }
    try {
      res.setHeader("Cache-Control","no-store");
      res.json(await previewSubjectMerge(parsed.data.sourceId,parsed.data.targetId));
    } catch (e) {
      console.error("Subject preview failed",e);
      res.status(500).json({error:"Unable to preview merge"});
    }
  });
  app.get(prefix+"/recovery/:operationId", authenticate, requireMainAdmin, async (req,res) => {
    const parsed = z.string().uuid().safeParse(req.params.operationId);
    if (!parsed.success) return res.status(400).json({error:"Invalid operation ID"});
    try {
      res.setHeader("Cache-Control","no-store");
      res.json(await checkSubjectMergeRecovery(parsed.data));
    } catch (e) {
      console.error("Recovery review failed",e);
      res.status(500).json({error:"Unable to review recovery"});
    }
  });
  app.post(prefix+"/master-preview", authenticate, requireMainAdmin, async (req,res) => {
    const parsed=z.object({referenceSchoolId:z.string().min(1).max(100),referenceClassId:z.string().min(1).max(100),selectedSubjectIds:z.array(z.string().uuid()).min(1).max(200)}).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error:"Invalid master configuration"});
    try {
      res.setHeader("Cache-Control","no-store");
      const p=parsed.data;
      res.json(await previewMasterClassConfiguration(p.referenceSchoolId,p.referenceClassId,p.selectedSubjectIds));
    } catch(e) {
      console.error("Master configuration preview failed",e);
      res.status(400).json({error:"Unable to preview configuration; check selected class and duplicate subjects"});
    }
  });
  // Execution endpoints intentionally omitted until report history, dependencies,
  // conflict archival and transaction tests have been verified.
}
