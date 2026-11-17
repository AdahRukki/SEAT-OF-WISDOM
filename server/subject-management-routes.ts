import { saveMasterConfiguration, loadMasterConfigurations } from "./master-subject-storage";
import { synchroniseMasterSubjects } from "./master-subject-sync";
import { previewMasterClassConfiguration } from "./master-subject-configuration";
import { listSubjectMergeHistory } from "./subject-merge-history";
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
  const sessionSchema=z.string().regex(/^\d{4}\/\d{4}$/).refine(s=>Number(s.slice(5))===Number(s.slice(0,4))+1);
  app.get(prefix+"/master-configurations",authenticate,requireMainAdmin,async(req,res)=>{
    const p=sessionSchema.safeParse(req.query.session);
    if(!p.success)return res.status(400).json({error:"Invalid academic session"});
    res.setHeader("Cache-Control","no-store");
    try{res.json(await loadMasterConfigurations(p.data));}
    catch(e){console.error("Master load failed",e);res.status(500).json({error:"Unable to load configurations"});}
  });
  app.post(prefix+"/master-configurations",authenticate,requireMainAdmin,async(req,res)=>{
    const p=z.object({referenceClassId:z.string().min(1).max(50),session:sessionSchema,subjectIds:z.array(z.string().uuid()).min(1).max(200),expectedVersion:z.number().int().nonnegative()}).strict().safeParse(req.body);
    const actorId=(req as any).user?.id;
    if(!actorId)return res.status(401).json({error:"Missing authenticated user"});
    if(!p.success)return res.status(400).json({error:"Invalid configuration"});
    res.setHeader("Cache-Control","no-store");
    if(process.env.ENABLE_MASTER_SUBJECT_WRITES!=="true")return res.status(503).json({error:"Master configuration writes are disabled pending verification"});
    try{res.json(await saveMasterConfiguration({...p.data,actorId}));}
    catch(e){console.error("Master save failed",e);res.status(409).json({error:"Unable to save; reload configuration and verify subjects"});}
  });
  app.post(prefix+"/master-sync-preview",authenticate,requireMainAdmin,async(req,res)=>{
    const p=z.object({versionId:z.string().uuid(),requestKey:z.string().uuid()}).strict().safeParse(req.body);
    const actorId=(req as any).user?.id;
    if(!actorId)return res.status(401).json({error:"Missing authenticated user"});
    if(!p.success)return res.status(400).json({error:"Invalid sync preview"});
    res.setHeader("Cache-Control","no-store");
    try{res.json(await synchroniseMasterSubjects({...p.data,actorId,apply:false}));}
    catch(e){console.error("Master sync preview failed",e);res.status(409).json({error:"Unable to preview saved configuration"});}
  });
  app.post(prefix+"/master-sync-apply",authenticate,requireMainAdmin,async(req,res)=>{
    const p=z.object({versionId:z.string().uuid(),requestKey:z.string().uuid(),expectedRevision:z.string().regex(/^[a-f0-9]{64}$/)}).strict().safeParse(req.body);
    const actorId=(req as any).user?.id;
    if(!actorId)return res.status(401).json({error:"Missing authenticated user"});
    if(!p.success)return res.status(400).json({error:"Invalid sync request"});
    res.setHeader("Cache-Control","no-store");
    if(process.env.ENABLE_MASTER_SUBJECT_WRITES!=="true")return res.status(503).json({error:"Synchronisation writes are disabled pending verification"});
    try{res.json(await synchroniseMasterSubjects({...p.data,actorId,apply:true}));}
    catch(e){console.error("Master sync failed",e);res.status(409).json({error:"Synchronisation failed or blocked; refresh preview before retrying"});}
  });
  app.get(prefix+"/merge-history",authenticate,requireMainAdmin,async(_req,res)=>{
    res.setHeader("Cache-Control","no-store");
    try{res.json(await listSubjectMergeHistory());}
    catch(e){console.error("Merge history failed",e);res.status(500).json({error:"Unable to load merge history"});}
  });
  // Merge and recovery execution remain disabled pending verification.
}
